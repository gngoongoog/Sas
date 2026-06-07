import { Client } from 'ssh2';

export interface OltSignalResult {
  oltPort: string;    // e.g. "1/1/1"
  onuIndex: string;   // e.g. "1"
  onuSerial: string;  // ONU serial number
  rxPower: number | null;  // e.g. -18.25 (dBm)
  txPower: number | null;  // e.g. -21.15 (dBm)
  distance: number | null; // in meters
  status: string;          // "active" | "offline"
}

export interface OltDevice {
  ip: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Clean version parsing matcher
 */
function parseVersion(output: string): string {
  const lines = output.split('\n');
  const versionLine = lines.find(l => l.toLowerCase().includes('version') || l.toLowerCase().includes('software'));
  return versionLine ? versionLine.replace(/[\r\n]/g, '').trim() : 'VSOL V1600G1';
}

/**
 * Executes an SSH command stream-style on interactive terminal OLT
 */
function executeCommand(stream: any, command: string, timeoutMs: number = 7000): Promise<string> {
  return new Promise((resolve) => {
    let output = '';
    
    const onData = (data: Buffer) => {
      const str = data.toString('utf8');
      output += str;
      
      // Check if output ends with typical OLT prompt (e.g. OLT# or OLT> or OLT(config)#)
      const trimmed = output.trim();
      const endsWithPrompt = /[\w().-]+[#>](\s*)$/.test(trimmed);
      if (endsWithPrompt) {
        cleanup();
        resolve(output);
      }
    };
    
    const timer = setTimeout(() => {
      cleanup();
      resolve(output); // Resolve with whatever was received on timeout
    }, timeoutMs);
    
    function cleanup() {
      clearTimeout(timer);
      stream.removeListener('data', onData);
    }
    
    stream.on('data', onData);
    stream.write(command + '\n');
  });
}

/**
 * Test connections to the VSOL OLT device via SSH - READ-ONLY only commands
 */
export async function testOltConnection(device: OltDevice): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const conn = new Client();
    let completed = false;
    
    const done = (success: boolean, msg: string) => {
      if (completed) return;
      completed = true;
      conn.end();
      resolve({ success, message: msg });
    };

    conn.on('ready', () => {
      conn.shell(async (err, stream) => {
        if (err) {
          return done(false, `خطأ في بدء جلسة الطرفية: ${err.message}`);
        }
        try {
          // Wait for initial terminal prompt
          await new Promise<void>((res) => {
            let buffer = '';
            const onInitData = (data: Buffer) => {
              buffer += data.toString('utf8');
              if (/[\w().-]+[#>](\s*)$/.test(buffer.trim())) {
                stream.removeListener('data', onInitData);
                res();
              }
            };
            stream.on('data', onInitData);
            setTimeout(() => {
              stream.removeListener('data', onInitData);
              res();
            }, 3000);
          });

          // Send show version to retrieve firmware version details
          const versionOutput = await executeCommand(stream, 'show version', 5000);
          stream.write('exit\n');
          
          if (versionOutput && versionOutput.toLowerCase().includes('version')) {
            done(true, `تم الاتصال بنجاح. الإصدار: ${parseVersion(versionOutput)}`);
          } else {
            done(true, 'تم الاتصال بنجاح بالجهاز (جهاز VSOL OLT متوافق)');
          }
        } catch (e: any) {
          done(false, `خطأ أثناء تنفيذ الأوامر: ${e.message}`);
        }
      });
    });

    conn.on('error', (err) => {
      done(false, `خطأ في الاتصال: ${err.message}`);
    });

    conn.on('timeout', () => {
      done(false, 'انتهت مهلة الاتصال بجهاز OLT (Timeout)');
    });

    conn.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 15000
    });
  });
}

/**
 * Fetch subscriber ONU signals and distance levels from VSOL OLT via SSH - STRICTLY READ-ONLY
 */
export async function fetchOltSignals(device: OltDevice): Promise<OltSignalResult[]> {
  return new Promise((resolve) => {
    const conn = new Client();
    let completed = false;
    const results: OltSignalResult[] = [];

    const done = (res: OltSignalResult[]) => {
      if (completed) return;
      completed = true;
      conn.end();
      resolve(res);
    };

    conn.on('ready', () => {
      conn.shell(async (err, stream) => {
        if (err) {
          console.error('[OLT fetchOltSignals] Shell failed:', err.message);
          return done([]);
        }

        try {
          // Wait for initial prompt
          await new Promise<void>((res) => {
            let buffer = '';
            const onInitData = (data: Buffer) => {
              buffer += data.toString('utf8');
              if (/[\w().-]+[#>](\s*)$/.test(buffer.trim())) {
                stream.removeListener('data', onInitData);
                res();
              }
            };
            stream.on('data', onInitData);
            setTimeout(() => {
              stream.removeListener('data', onInitData);
              res();
            }, 3000);
          });

          // 1. terminal length 0 -> Disables paging in VSOL console
          await executeCommand(stream, 'terminal length 0', 4000);

          // 2. show gpon onu state -> Dumps state of all ONUs on GPON OLT
          const stateOutput = await executeCommand(stream, 'show gpon onu state', 10000);

          const onus: { port: string; onuId: string; serial: string; status: string }[] = [];
          const lines = stateOutput.split('\n');
          
          for (const line of lines) {
            const trimmed = line.trim();
            // Match GPON state lines: port, index, serial, status
            const match = trimmed.match(/^([\w/.-]+)\s+(\d+)\s+([A-Za-z0-9_-]+)\s+(\w+)/);
            if (match) {
              const port = match[1];
              const onuId = match[2];
              const serial = match[3];
              const status = match[4];

              // Skip column headers
              if (
                port.toLowerCase().includes('port') || 
                serial.toLowerCase().includes('serial') || 
                status.toLowerCase().includes('status') ||
                port.toLowerCase().includes('gpon') && onuId.toLowerCase().includes('onu')
              ) {
                continue;
              }

              onus.push({ port, onuId, serial, status });
            }
          }

          // Fallback parsing pattern
          if (onus.length === 0) {
            for (const line of lines) {
              const trimmed = line.trim();
              const match = trimmed.match(/(\d+\/\d+\/\d+)\s+(\d+)\s+([A-Za-z0-9]+)\s+(\w+)/);
              if (match) {
                onus.push({
                  port: match[1],
                  onuId: match[2],
                  serial: match[3],
                  status: match[4]
                });
              }
            }
          }

          if (onus.length === 0) {
            console.log('[OLT fetchOltSignals] No ONUs parsed from output:', stateOutput);
            stream.write('exit\n');
            return done([]);
          }

          // 3. For each ONU, query optical attenuation
          for (const onu of onus) {
            try {
              const cmd = `show pon power attenuation ${onu.port} ${onu.onuId}`;
              const attOutput = await executeCommand(stream, cmd, 5000);

              // Regex matches for Rx power
              const rxMatch = attOutput.match(/(?:Rx optical power|ONU RX Power|RX Power)\s*:\s*(-?\d+(?:\.\d+)?)\s*dBm/i);
              // Regex matches for Tx power
              const txMatch = attOutput.match(/(?:Tx optical power|ONU TX Power|TX Power)\s*:\s*(-?\d+(?:\.\d+)?)\s*dBm/i);
              // Regex matches for distances (handling both m and km)
              const distMatch = attOutput.match(/(?:ONU distance|ONU Distance|Distance)\s*:\s*(\d+(?:\.\d+)?)\s*(?:m|km)/i);

              const rxPower = rxMatch ? parseFloat(rxMatch[1]) : null;
              const txPower = txMatch ? parseFloat(txMatch[1]) : null;
              
              let distance: number | null = null;
              if (distMatch) {
                const rawVal = parseFloat(distMatch[1]);
                const isKm = distMatch[0].toLowerCase().includes('km');
                distance = isKm ? Math.round(rawVal * 1000) : Math.round(rawVal);
              }

              results.push({
                oltPort: onu.port,
                onuIndex: onu.onuId,
                onuSerial: onu.serial,
                rxPower,
                txPower,
                distance,
                status: onu.status.toLowerCase() === 'active' || onu.status.toLowerCase() === 'online' || onu.status.toLowerCase() === 'up' ? 'active' : 'offline'
              });
            } catch (onuErr: any) {
              console.error(`[OLT fetchOltSignals] Failed to parse ONU ${onu.port}:${onu.onuId}:`, onuErr.message);
              results.push({
                oltPort: onu.port,
                onuIndex: onu.onuId,
                onuSerial: onu.serial,
                rxPower: null,
                txPower: null,
                distance: null,
                status: onu.status.toLowerCase() === 'active' || onu.status.toLowerCase() === 'online' || onu.status.toLowerCase() === 'up' ? 'active' : 'offline'
              });
            }
          }

          // Send exit clean-up and terminate stream
          stream.write('exit\n');
          done(results);
        } catch (e: any) {
          console.error('[OLT fetchOltSignals] Fatal SSH interactive error:', e.message);
          done([]);
        }
      });
    });

    conn.on('error', (err) => {
      console.error('[OLT fetchOltSignals] SSH Connection Error:', err.message);
      done([]);
    });

    conn.on('timeout', () => {
      console.error('[OLT fetchOltSignals] SSH Connection Timeout');
      done([]);
    });

    conn.connect({
      host: device.ip,
      port: device.port || 22,
      username: device.username,
      password: device.password,
      readyTimeout: 15000
    });
  });
}
