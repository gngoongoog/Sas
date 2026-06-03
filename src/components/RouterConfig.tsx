import React, { useState } from 'react';
import { useSystem } from '../context/SystemContext';
import { Router } from '../types';
import { 
  Network, 
  Cpu, 
  Layers, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Settings, 
  Server,
  Activity,
  UserCheck,
  RefreshCw,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Shield
} from 'lucide-react';

export const RouterConfig: React.FC = () => {
  const {
    routers,
    addRouter,
    deleteRouter,
    pingRouter,
    subscribers
  } = useSystem();

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    apiPort: 8728,
    username: '',
    password: '',
    location: ''
  });

  const [testingId, setTestingId] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'list' | 'map' | 'pools' | 'remote'>('list');

  // VPN Guide States
  const [selectedVpn, setSelectedVpn] = useState<'tailscale' | 'zerotier'>('tailscale');
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [vpnSubnet, setVpnSubnet] = useState('192.168.88.0/24');
  const [zerotierNetId, setZerotierNetId] = useState('d5e5f5c5a5b5c5d2');

  // Interactive Map State
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Simulated IP Pools Data matched with active system profile/subscriber allocations
  const [ipPools, setIpPools] = useState([
    { id: 'pool-1', name: 'pppoe-pool-standard', gateway: '10.10.10.1', range: '10.10.10.2 - 10.10.10.254', totalIPs: 253, interface: 'bridge-local', dns: '8.8.8.8, 1.1.1.1' },
    { id: 'pool-2', name: 'pppoe-pool-premium', gateway: '10.20.20.1', range: '10.20.20.2 - 10.20.20.254', totalIPs: 253, interface: 'vlan-100-internet', dns: '109.122.1.1, 109.122.1.2' },
    { id: 'pool-3', name: 'dhcp-local-lan', gateway: '192.168.88.1', range: '192.168.88.10 - 192.168.88.250', totalIPs: 241, interface: 'bridge-local', dns: '8.8.8.8' }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ip || !formData.username) {
      alert('الرجاء كتابة كافة معلومات الدخول الأساسية.');
      return;
    }

    addRouter(formData);
    setModalOpen(false);
  };

  const handlePing = async (id: string) => {
    setTestingId(id);
    await pingRouter(id);
    setTestingId(null);
  };

  const getSubscribersForRouter = (routerId: string) => {
    return subscribers.filter(s => s.routerId === routerId).length;
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Upper Title Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            أجهزة وسيرفرات مايكروتك (MikroTik Central Nodes)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">ربط ومتابعة المايكروتك المركزي وقراءة بيانات الـ API والمزامنة الفورية لحسابات PPPoE Secrets.</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', ip: '', apiPort: 8728, username: 'admin', password: '', location: '' });
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 text-white" />
          أضف سيرفر (MikroTik)
        </button>
      </div>

      {/* Tabs navigation switches */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-0.5">
        <button
          onClick={() => setSubTab('list')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'list'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📋 قائمة الأجهزة والسيرفرات ({routers.length})
        </button>
        <button
          onClick={() => setSubTab('map')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'map'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🌐 خريطة الشبكة التفاعلية ومراقبة النبض
        </button>
        <button
          onClick={() => setSubTab('pools')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'pools'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🔬 محلل مستودعات عناوين الأيبات (IP Pools & Subnets)
        </button>
        <button
          onClick={() => setSubTab('remote')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            subTab === 'remote'
              ? 'border-blue-600 text-blue-650 bg-blue-550/5'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🔒 دليل الـ VPN والوصول عن بعد للأجهزة والـ Mini PC
        </button>
      </div>

      {/* SUB TAB 1: Routers List */}
      {subTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {routers.map(r => {
            const isOnline = r.status === 'online';
            const isOffline = r.status === 'offline';
            const isConnecting = r.status === 'connecting';
            const userCount = getSubscribersForRouter(r.id);

            // Simulated hardware values
            const cpuVal = isOnline ? (r.id === 'r-1' ? 44 : 12) : 0;
            const memVal = isOnline ? (r.id === 'r-1' ? 62 : 35) : 0;

            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                
                {/* Header Status row */}
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-700">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs font-sans">{r.name}</h3>
                        <p className="text-[10px] text-slate-450 font-mono mt-0.5">{r.ip}:{r.apiPort}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold ${
                      isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      isOffline ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {isOnline ? '● متصل بنجاح' : isOffline ? '● غير متصل' : '⏱ جاري الإتصال...'}
                    </span>
                  </div>

                  {/* Simulated Telemetry Cards (only for online nodes) */}
                  {isOnline && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      
                      {/* CPU */}
                      <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100/50 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-sans">
                          <Cpu className="w-3 h-3 text-slate-400" />
                          المعالج CPU
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-800">{cpuVal}%</span>
                      </div>

                      {/* Active Leases */}
                      <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100/50 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-sans">
                          <UserCheck className="w-3 h-3 text-slate-400" />
                          العملاء
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-800">{userCount}</span>
                      </div>

                    </div>
                  )}

                  {/* Additional node properties */}
                  <div className="space-y-2 mt-4 border-t border-slate-50 pt-3 text-[11px] font-sans text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">موقع البرج / الكابينة:</span>
                      <span className="text-slate-800 font-medium">{r.location || 'عام العاصمة'}</span>
                    </div>

                    <div className="flex justify-between font-mono">
                      <span className="text-slate-400 font-sans">نظام التشغيل:</span>
                      <span className="text-indigo-600 text-[10px]">{r.version || 'RouterOS v7'}</span>
                    </div>
                  </div>
                </div>

                {/* Node actions footer */}
                <div className="flex justify-end gap-2 border-t border-slate-50 pt-3 mt-4 text-[11px] font-sans">
                  
                  {/* Ping API test */}
                  <button
                    disabled={isConnecting}
                    onClick={() => handlePing(r.id)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1 cursor-pointer font-medium font-sans transition-all disabled:opacity-50 select-none text-[10px]"
                  >
                    <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
                    {isConnecting ? 'اختبار الإتصال...' : 'فحص الاتصال API'}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (userCount > 0) {
                        alert('عذراً: لا يمكن إزالة السيرفر لوجود مستخدمين وعملاء مربوطين به حالياً.');
                        return;
                      }
                      if (confirm(`هل أنت واثق من مسح السيرفر المايكروتك [${r.name}] من لوحة SuperSAS؟`)) {
                        deleteRouter(r.id);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-md flex items-center gap-1 cursor-pointer transition-all text-[10px]"
                  >
                    <Trash2 className="w-3 h-3" /> مسح
                  </button>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* SUB TAB 2: Interactive Network Map & Telemetry Dashboard */}
      {subTab === 'map' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
              <Network className="w-4.5 h-4.5 text-blue-600" />
              منظومة المزامنة ومخطط العقد والموجهات لـ SuperSAS
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">توضح هذه الخريط الاتصال المنطقي بين عقدة راديوس السيرفر المركزي وأنودات أجهزة المايكروتك التي تراقبها. اضغط على أي موجه لمعاينة نبض البيانات التلسكوبية اللحظية.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Map Canvas drawing with SVG connector lines */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-950 p-6 rounded-xl relative min-h-[380px] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1px)] [background-size:16px_16px] opacity-60" />
              
              {/* Central Radius Gateway Node */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                <div className="p-4 bg-blue-600 text-white rounded-full border-4 border-slate-900 shadow-xl relative animate-pulse">
                  <Server className="w-8 h-8" />
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                </div>
                <span className="text-[11px] text-slate-200 font-bold bg-slate-950 px-2.5 py-1 rounded-full border border-slate-850 mt-2 filter backdrop-blur-md">
                  سيرفر البوابة الرئيسي
                </span>
                <span className="text-[9px] text-blue-450 font-mono mt-0.5">SuperSAS Radius v4.0</span>
              </div>

              {/* Connecting Web lines to client routers */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {routers.map((r, index) => {
                  const angle = (index * (360 / Math.max(1, routers.length)) * Math.PI) / 180;
                  const radius = 130;
                  // Center offset on map is around 50%
                  const startX = "50%";
                  const startY = "50%";
                  const isOnline = r.status === 'online';

                  return (
                    <line
                      key={`line-${r.id}`}
                      x1="50%"
                      y1="50%"
                      x2={`${50 + radius * Math.cos(angle) / 4}%`}
                      y2={`${50 + radius * Math.sin(angle) / 3}%`}
                      stroke={isOnline ? '#10b981' : '#f43f5e'}
                      strokeWidth={2}
                      strokeDasharray={isOnline ? '5,5' : '1,5'}
                      className={isOnline ? 'animate-marquee' : ''}
                      style={{ animationDuration: '4s' }}
                    />
                  );
                })}
              </svg>

              {/* Position Routers in Orbiting Circular Arrangement */}
              {routers.map((r, index) => {
                const angle = (index * (360 / Math.max(1, routers.length)) * Math.PI) / 180;
                const radiusX = 35; // represented as percentage offset
                const radiusY = 28;
                const isOnline = r.status === 'online';
                const isSelected = selectedNode === r.id;

                const leftPos = 50 + radiusX * Math.cos(angle);
                const topPos = 50 + radiusY * Math.sin(angle);

                return (
                  <button
                    key={`node-${r.id}`}
                    onClick={() => setSelectedNode(r.id)}
                    style={{ left: `${leftPos}%`, top: `${topPos}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 p-3 rounded-xl border z-10 font-sans transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-400 scale-110 shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/10'
                        : isOnline 
                          ? 'bg-slate-950 text-slate-200 border-emerald-500/55 hover:bg-slate-900 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-red-500/35 hover:bg-slate-900 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <Cpu className={`w-4 h-4 ${isOnline ? 'text-emerald-450 animate-pulse快速' : 'text-slate-500'}`} />
                      <span className="text-[10px] font-bold block">{r.name}</span>
                      <span className="text-[8px] font-mono text-slate-400 block">{r.ip}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Side Telemetry Details Panel */}
            <div className="lg:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              {(() => {
                const node = routers.find(r => r.id === (selectedNode || routers[0]?.id));
                if (!node) {
                  return (
                    <div className="text-center py-12">
                      <p className="text-xs text-slate-400">يرجى تحديد جهاز مايكروتك من الخريطة لمعاينة حالته بالتفصيل.</p>
                    </div>
                  );
                }

                const isOnline = node.status === 'online';
                const usersCount = getSubscribersForRouter(node.id);
                const cpuPercentage = isOnline ? (node.id === 'r-1' ? 44 : 12) : 0;
                const ramPercent = isOnline ? (node.id === 'r-1' ? 62 : 35) : 0;
                
                return (
                  <div className="space-y-4 flex-1 flex flex-col justify-between text-xs">
                    
                    {/* Upper title */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold bg-slate-250 px-2 py-0.5 rounded-sm font-sans tracking-wide text-slate-600">بيانات التليمتري والنبض النودي</span>
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-800 font-sans">{node.name}</h4>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                      </div>
                      <p className="text-[10px] text-slate-450">IP Central: <code className="font-mono text-slate-700 bg-slate-200/50 px-1 py-0.5 rounded">{node.ip}</code></p>
                    </div>

                    {/* Data meters */}
                    <div className="space-y-3 pt-3 border-t border-slate-200/60">
                      
                      {/* Meter 1: CPU */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>استهلاك معالج الراوتر:</span>
                          <span className="font-bold text-slate-900 font-mono">{cpuPercentage}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${cpuPercentage > 75 ? 'bg-rose-500' : cpuPercentage > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${cpuPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Meter 2: Memory */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>الذاكرة العشوائية المستهلكة (RAM):</span>
                          <span className="font-bold text-slate-900 font-mono">{ramPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${ramPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Meter 3: Users limits */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>العملاء النشطون / السعة القصوى:</span>
                          <span className="font-bold text-slate-900 font-mono">{usersCount} / 250</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${(usersCount / 250) * 100}%` }}
                          />
                        </div>
                      </div>

                    </div>

                    {/* Real-time ping speed graph simulation */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 mt-3">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-sans">
                        <span>سرعة الـ Ping اللحظية (API):</span>
                        <span className="text-emerald-600 font-mono font-bold">{isOnline ? `${node.id === 'r-1' ? '18ms' : '11ms'}` : 'N/A'}</span>
                      </div>
                      
                      <div className="h-10 flex items-end gap-1 px-1">
                        {isOnline ? (
                          [40, 35, 45, 30, 25, 30, 20, 28, 33, 40, 15, 22].map((h, i) => (
                            <div 
                              key={i} 
                              className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 rounded-sm transition-colors" 
                              style={{ height: `${h}%` }} 
                              title={`ping: ${h}ms`}
                            />
                          ))
                        ) : (
                          <div className="w-full text-center text-[11px] text-rose-500 font-sans font-bold italic py-2">
                            السيرفر خارج الاتصال (API Down)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick diagnostics triggers */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-250 mt-3 font-sans">
                      <button
                        onClick={() => handlePing(node.id)}
                        disabled={node.status === 'connecting'}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-55 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${node.status === 'connecting' ? 'animate-spin' : ''}`} />
                        اختبار وتحديث التليمتري الآن
                      </button>
                    </div>

                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* SUB TAB 3: IP Address Pools & Subnet Analyzer */}
      {subTab === 'pools' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
              <Network className="w-4.5 h-4.5 text-blue-600" />
              محلل مستودعات عناوين الأيبات وجداول الفرعيات للروترات
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">تتبع وعاين مستودعات التوزيع (IP Pools) المعتمدة على المايكروتك المركزي للمشتركين والمزودة لنظام PPPoE Secrets لتلافي مشاكل النفاد واشغال طوابق الـ IPs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ipPools.map(pool => {
              // Calculate allocations using mock logic corresponding to active system subscribers
              const matchCount = pool.id === 'pool-1' 
                ? subscribers.filter(s => s.profileId === 'p-1' && s.status === 'active').length
                : pool.id === 'pool-2'
                  ? subscribers.filter(s => s.profileId === 'p-2' && s.status === 'active').length
                  : 4; // simulated DHCP used IPs

              const usagePercent = Math.min(100, Math.round((matchCount / pool.totalIPs) * 100));

              return (
                <div key={pool.id} className="bg-slate-50 p-4 border border-slate-200 rounded-xl relative overflow-hidden flex flex-col justify-between">
                  {/* Decorative background circle */}
                  <div className="absolute top-0 left-0 w-16 h-16 bg-slate-100 rounded-br-2xl -z-0 flex items-center justify-center text-slate-200/60 font-mono text-xs font-bold">
                    POOL
                  </div>

                  <div className="space-y-4 relative z-10 text-xs">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="block text-[10px] font-bold text-slate-400">مستودع عناوين المنفذ: {pool.interface}</span>
                        <h4 className="text-xs font-bold text-slate-800 font-mono">{pool.name}</h4>
                      </div>
                      
                      {/* Percent indicator */}
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm font-bold text-[9px] ${
                        usagePercent > 80 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {usagePercent}% مستخدم
                      </span>
                    </div>

                    <div className="space-y-2 font-mono text-[11px] text-slate-600 border-t border-b border-indigo-50/55 py-2.5">
                      <div className="flex justify-between">
                        <span className="text-slate-450 font-sans">بوابة العنونة Gateway:</span>
                        <span className="text-slate-800 font-bold">{pool.gateway}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450 font-sans">نطاق التوزيع Range:</span>
                        <span className="text-slate-800 font-bold text-[10px]">{pool.range}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-450 font-sans font-sans">سيرفرات DNS المرفقة:</span>
                        <span className="text-slate-500 text-[10px]">{pool.dns}</span>
                      </div>
                    </div>

                    {/* Utilization Progress bar */}
                    <div className="space-y-1 font-sans">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>العناوين المحجوزة:</span>
                        <span className="font-bold text-slate-800">{matchCount} من أصل {pool.totalIPs} IPs</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${usagePercent > 80 ? 'bg-rose-550' : 'bg-blue-600'}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick conflict advisory block */}
          <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-3">
            <span className="p-1 px-1.5 bg-amber-100 text-amber-800 rounded text-xs font-black">ADVISORY</span>
            
            <div className="text-xs text-amber-800 leading-relaxed font-sans">
              <p className="font-bold">مراقب تضارب عناوين الـ IP وتنبؤ الإشغال (Conflict & Exhaustion Watchdog)</p>
              <p className="mt-1 font-medium">يقوم النظام تلقائياً بفحص الأجهزة والـ PPPoE Secrets لتسجيل وجود أي IPs معينة استاتيكيا خارج نطاق الـ IP Pools تجنباً لحقن تضارب الأيبات (IP Conflicts) بالمايكروتك. مستودعاتك الحالية مستقرة ومؤمنة بنسبة 100%.</p>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: Advanced Interactive Remote Access & VPN Routing Guide */}
      {subTab === 'remote' && (
        <div className="space-y-6 animate-in fade-in duration-200 text-right" dir="rtl">
          
          {/* Main Hero Header Visual */}
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-xl">
            {/* Background glowing gradients */}
            <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-600/10 rounded-full filter blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center relative z-10">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-400 text-xs font-bold font-sans">
                  <Shield className="w-4 h-4 text-blue-400" />
                  أمان مستقر بنسبة 100% دون فتح بورتات (No Port Forwarding)
                </div>
                <h3 className="text-xl md:text-2xl font-black font-sans leading-tight">
                  دليل الوصول عن بعد للوحة SuperSAS والمايكروتك من أي مكان
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed font-sans">
                  هل قمت بتشغيل المنظومة على **Mini PC** داخل برجك أو مكتبك وتود التحكم بالكامل بلوحة المشتركين وتفعيل الكروت للمشترك المنتهي من بيتك أو هاتفك؟
                  باستخدام تقنية **VPN الهجينة** (مثل **Tailscale** أو **ZeroTier**)، يمكنك بناء شبكة مشفرة آمنة تماماً والدخول للنظام بسهولة من أي مكان بالخارج دون الحاجة لشراء IP خارجي ساكن أو التلاعب بإعدادات جدار الحماية في راوتر الـ ONU المندفع بالشبكة.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 bg-slate-950/60 p-4 border border-slate-850 rounded-xl font-mono text-center">
                <div>
                  <span className="block text-[22px] font-black text-emerald-450">0%</span>
                  <span className="block text-[9px] text-slate-500 uppercase mt-0.5 font-sans">صعوبة واختراقات</span>
                </div>
                <div className="w-px h-10 bg-slate-800" />
                <div>
                  <span className="block text-[22px] font-black text-blue-450">SECURE</span>
                  <span className="block text-[9px] text-slate-500 uppercase mt-0.5 font-sans">قنوات مشفرة</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Tool Configurator and Tutorial panels */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Right block: Tabbed VPN installation and commands (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* VPN Selector Control Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-850 font-sans">اختر مزود الـ VPN المفضل لديك للبدء:</h4>
                    <p className="text-xs text-slate-450 mt-0.5 font-sans">نوفر لك إرشادات مخصصة ومدمجة مع مولد أكواد ديناميكي لسهولة النسخ</p>
                  </div>
                  
                  {/* Selectors */}
                  <div className="flex bg-slate-100 p-1 border border-slate-205/50 rounded-xl text-xs font-bold font-sans self-stretch sm:self-auto">
                    <button
                      onClick={() => setSelectedVpn('tailscale')}
                      className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        selectedVpn === 'tailscale' 
                          ? 'bg-white text-blue-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Tailscale (موصى به جداً)
                    </button>
                    <button
                      onClick={() => setSelectedVpn('zerotier')}
                      className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        selectedVpn === 'zerotier' 
                          ? 'bg-white text-emerald-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Network className="w-3.5 h-3.5" />
                      ZeroTier (خيار بديل)
                    </button>
                  </div>
                </div>

                {/* Subnet customizer helper in real-time */}
                <div className="p-3 bg-blue-50/50 border border-blue-100/60 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 font-sans block">⚙️ مخصّص الأوامر الذكي (Dynamic Value Injector):</span>
                    <span className="text-[10px] text-slate-450 font-sans block">أدخل رقم شبكة المايكروتك المحلية الخاصة بك لتوليد الأكواد المطلوبة جاهزة لبرجك</span>
                  </div>
                  
                  <div className="flex gap-2">
                    {selectedVpn === 'tailscale' ? (
                      <div className="w-full text-right">
                        <label className="text-[9px] font-bold text-slate-400 block mb-1">Subnet راوتر المايكروتك</label>
                        <input
                          type="text"
                          value={vpnSubnet}
                          onChange={(e) => setVpnSubnet(e.target.value)}
                          placeholder="192.168.88.0/24"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left focus:ring-1 focus:ring-blue-500 text-slate-800 focus:outline-hidden"
                        />
                      </div>
                    ) : (
                      <div className="w-full text-right">
                        <label className="text-[9px] font-bold text-slate-400 block mb-1">معرّف شبكة ZeroTier (Network ID)</label>
                        <input
                          type="text"
                          value={zerotierNetId}
                          onChange={(e) => setZerotierNetId(e.target.value)}
                          placeholder="d5e5f5c5a5b5c5d2"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left focus:ring-1 focus:ring-emerald-500 text-slate-800 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* TAILSCALE SECTION */}
                {selectedVpn === 'tailscale' && (
                  <div className="space-y-6 pt-2 font-sans text-xs">
                    
                    {/* Step 1 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                        <h5 className="font-bold text-slate-800">تثبيت Tailscale على الـ Mini PC (سيرفر المنظومة)</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        افتح شاشة سطر الأوامر (Terminal) للـ Mini PC (المشغل للينكس أو أوبونتو) وقم بتحميل وتثبيت الحزمة الرسمية للأداة بكتابة الأمر التالي:
                      </p>
                      
                      {/* Code Block */}
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 font-mono text-xs pr-7 relative group flex justify-between items-center mr-7">
                        <code className="text-left block text-[11px] text-blue-300">curl -fsSL https://tailscale.com/install.sh | sh</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText('curl -fsSL https://tailscale.com/install.sh | sh');
                            setCopiedScript('ts-1');
                            setTimeout(() => setCopiedScript(null), 2000);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded text-slate-300 cursor-pointer transition-all flex items-center gap-1 select-none"
                        >
                          {copiedScript === 'ts-1' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-450">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ الحزمة</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                        <h5 className="font-bold text-slate-800">تشغيل وتسجيل الـ Mini PC بالشبكة</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        الآن، اطلب تشغيل الأداة لربطها بالشبكة الآمنة عبر البريد الإلكتروني الخاص بك:
                      </p>

                      {/* Code Block */}
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 font-mono text-xs pr-7 relative group flex justify-between items-center mr-7">
                        <code className="text-left block text-[11px] text-blue-300">sudo tailscale up</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText('sudo tailscale up');
                            setCopiedScript('ts-2');
                            setTimeout(() => setCopiedScript(null), 2000);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded text-slate-300 cursor-pointer transition-all flex items-center gap-1 select-none"
                        >
                          {copiedScript === 'ts-2' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-450">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-amber-700 bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-[10.5px] font-medium leading-relaxed mr-7">
                        ℹ️ **ماذا سيحدث بعد تنفيذ هذا الأمر؟**
                        سيظهر لك رابط مصادقة مميز بشاشة الـ Terminal. افتحه من أي هاتف أو لابتوب لديك، وسجل الدخول مجاناً بحساب جوجل الخاص بك. سيتم تسجيل الـ Mini PC تلقائياً بالكامل في لوحتك الشخصية وسيتخذ عنوان آي بي ثابت ومحمي خاص به بالشبكة المشفرة (مثل <code>100.x.x.x</code>).
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                        <h5 className="font-bold text-slate-800">مشاركة شبكة المايكروتك بالكامل (Subnet Routing)</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        لتتمكن من الوصول للمايكروتك، سيرفرات الـ API، والـ Winbox مباشرة من بيتك دون تنصيب برامج على المايكروتك نفسه، اطلب من Tailscale بالـ Mini PC بث وتمرير شبكته المحلية بكتابة الأمر المخصّص التالي:
                      </p>

                      {/* Code Block */}
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 font-mono text-xs pr-7 relative group flex justify-between items-center mr-7">
                        <code className="text-left block text-[11px] text-blue-300">sudo tailscale up --advertise-routes={vpnSubnet} --accept-dns=false</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`sudo tailscale up --advertise-routes=${vpnSubnet} --accept-dns=false`);
                            setCopiedScript('ts-3');
                            setTimeout(() => setCopiedScript(null), 2000);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded text-slate-300 cursor-pointer transition-all flex items-center gap-1 select-none font-sans"
                        >
                          {copiedScript === 'ts-3' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-450">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ الكود المخصّص</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        بعد التنفيذ: ادخل لموقع لوحة تحكم <b>Tailscale Admin Console</b> من اللابتوب الخاص بك، اضغط على النقاط الثلاث بجوار اسم الـ Mini PC، ثم اختر <b>Edit Route Settings</b> وقم بتفعيل مربع الاختيار بجوار الشبكة <code>{vpnSubnet}</code> (أي عمل <b>Approve Subnets</b>).
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                        <h5 className="font-bold text-slate-800">الدخول والتحكم الآمن من بيتك أو موبايلك بالكامل</h5>
                      </div>
                      <div className="mr-7 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-650 leading-relaxed text-[11px]">
                        <p>👍 **مبروك! نجحت العملية بالكامل.** للوصول المباشر الآن والتحكم من البيت:</p>
                        <ol className="list-decimal list-inside space-y-1 pr-1">
                          <li>قم بتنزيل برنامج <b>Tailscale</b> على هاتفك أو كمبيوترك في المنزل وسجل الدخول بنفس الحساب.</li>
                          <li>للدخول إلى لوحة تحكم <b>SuperSAS</b> من المنزل: افتح المتصفح واكتب الـ IP الخاص بالـ Mini PC (مثال: <code>http://100.99.88.77:3000</code>).</li>
                          <li>للدخول بسيرفر المايكروتك أو الـ <b>Winbox</b>: افتح الـ Winbox بالبيت واكتب الـ IP المحلي للسيرفر في برجك مباشرة (مثال <code>{vpnSubnet.split('/')[0].replace('.0', '.1')}</code>) وسيعمل فوراً وبسرعة فائقة تفوق الخيال!</li>
                        </ol>
                      </div>
                    </div>

                  </div>
                )}

                {/* ZEROTIER SECTION */}
                {selectedVpn === 'zerotier' && (
                  <div className="space-y-6 pt-2 font-sans text-xs">
                    
                    {/* Step 1 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                        <h5 className="font-bold text-slate-800 font-sans">تنصيب ZeroTier على جهاز الـ Mini PC</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        نفّذ هذا السكريبت الرسمي المباشر لبث وتصميم منصة تحكم ZeroTier One آلياً داخل الميني بيسي:
                      </p>
                      
                      {/* Code Block */}
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 font-mono text-xs pr-7 relative group flex justify-between items-center mr-7">
                        <code className="text-left block text-[11px] text-emerald-300">curl -s https://install.zerotier.com | sudo bash</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText('curl -s https://install.zerotier.com | sudo bash');
                            setCopiedScript('zt-1');
                            setTimeout(() => setCopiedScript(null), 2000);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded text-slate-300 cursor-pointer transition-all flex items-center gap-1 select-none font-sans"
                        >
                          {copiedScript === 'zt-1' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-450 font-bold">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                        <h5 className="font-bold text-slate-800">الارتباط بشبكتك الافتراضية الخاصة</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        قم بالدخول إلى موقع <a href="https://my.zerotier.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline inline-flex items-center gap-0.5">zerotier.com <ExternalLink className="w-3 h-3" /></a> واصنع شبكة جديدة بالكامل مجاناً، ثم قم بربط الميني بيسي بها عبر كتابة الكود التالي:
                      </p>

                      {/* Code Block */}
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 font-mono text-xs pr-7 relative group flex justify-between items-center mr-7">
                        <code className="text-left block text-[11px] text-emerald-300">sudo zerotier-cli join {zerotierNetId}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`sudo zerotier-cli join ${zerotierNetId}`);
                            setCopiedScript('zt-2');
                            setTimeout(() => setCopiedScript(null), 2000);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded text-slate-300 cursor-pointer transition-all flex items-center gap-1 select-none font-sans"
                        >
                          {copiedScript === 'zt-2' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-450 font-bold">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ الكود المدمج</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        ⚠️ **هام:** بعد تنفيذ الأمر بالميني بيسي، انتقل للوحة تحكم شبكة ZeroTier في المتصفح، ابحث عن جدول الأعضاء (Members) وحدد المربع الموجود تحت عمود <b>Auth?</b> لتمنح السيرفر تصريح الدخول لشبكتك والحصول على الـ IP.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                        <h5 className="font-bold text-slate-800 font-sans">توجيه شبكة المايكروتك بالـ Routing Table</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        لتمرير شبكة المايكروتك لبيتك، انتقل إلى إعدادات لوحة تحكم شبكة ZeroTier (قسم Managed Routes)، واكشِف المسار كالتالي:
                      </p>
                      <div className="mr-7 p-3 bg-slate-50 border border-slate-205 rounded-lg font-mono text-[11px] text-slate-700 space-y-1">
                        <div>• حقل الـ Target: اكتب شبكة المايكروتك <code>{vpnSubnet}</code></div>
                        <div>• حقل الـ (Via/Gateway): اكتب عنوان الـ IP الذي منحه ZeroTier لسيرفر الميني بيسي (مثلاً: <code>10.147.x.x</code>)</div>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                        <h5 className="font-bold text-slate-800 font-sans">استمتع بتسهيل العمل فورا</h5>
                      </div>
                      <p className="text-slate-500 leading-relaxed pr-7">
                        الآن، ثبّت تطبيق ZeroTier على جوالك أو حاسوبك بالمنزل، انضم لنفس الـ Network ID، وافتح لوحة تحكم SuperSAS من أي ثغرة في العالم آمنة، دون منفردات Port Forward.
                      </p>
                    </div>

                  </div>
                )}

              </div>
              
              {/* MikroTik Native Integration tip block */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-1.5 text-blue-600 font-sans">
                  <Cpu className="w-4.5 h-4.5 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-850">💡 نصيحة ميكروتك للمحترفين (MikroTik ROSv7 Container feature)</h4>
                </div>
                <div className="text-xs text-slate-500 leading-relaxed font-sans space-y-2">
                  <p>
                    إذا كان جهاز المايكروتك لديك من طاقة عالية المعالجة (مثل CCR2004 أو CCR1009) ومثبت عليه الإصدار الحديث للميكروتك **RouterOS v7**، فإنه يدعم تقنية الحاويات **Containers**.
                  </p>
                  <p>
                    تستطيع تثبيت Tailscale أو ZeroTier كـ Container مدمج **داخل المايكروتك مباشرة** دون الحاجة للمرور بالـ Mini PC كبوابة. لكننا ننصح دائماً بالطريقة المدرجة أعلاه (Subnet Routes عبر الميني بيسي) لأنها **متوافقة مع 100% من أجهزة الروترات حتى الفئات منخفضة التكاليف جداً** وخفيفة تماماً على طاقة المعالجة في السيرفر.
                  </p>
                </div>
              </div>

            </div>

            {/* Left block: Frequently Asked Questions / Sidebar layout (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* VPN Architecture Flow mockup card */}
              <div className="bg-slate-950 text-slate-200 p-5 rounded-xl border border-slate-850 shadow-md space-y-4 font-sans text-xs flex flex-col justify-between">
                <div>
                  <h5 className="font-bold text-blue-400 font-sans tracking-wide">💡 مخطط التدفق الـ VPN السري</h5>
                  <p className="text-[10.5px] text-slate-400 mt-1">توضيح لحركة البيانات في شبكتك الآمنة:</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-[10px] space-y-3 relative overflow-hidden text-left leading-relaxed">
                  
                  {/* Home Device */}
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded">
                    <span className="text-amber-400">📱 الهاتف / اللابتوب بالبيت</span>
                    <span className="text-slate-500 font-mono">100.115.x.y</span>
                  </div>

                  {/* Flow arrow down */}
                  <div className="text-center text-blue-404 font-bold my-1 text-slate-500 block">
                    ↓ (قناة مشفرة وآمنة عبر الـ VPN)
                  </div>

                  {/* Mini PC */}
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded">
                    <span className="text-blue-400">🖥️ الـ Mini PC بالبرج</span>
                    <span className="text-slate-500 font-mono">100.95.x.x</span>
                  </div>

                  {/* Flow arrow down */}
                  <div className="text-center text-emerald-404 font-bold my-1 text-slate-400 block">
                    ↓ (توجيه محلي Subnet Routing)
                  </div>

                  {/* Mikrotik Router */}
                  <div className="flex justify-between items-center bg-slate-950 p-2 rounded">
                    <span className="text-emerald-400">📡 موجه المايكروتك Central</span>
                    <span className="text-slate-500 font-mono">192.168.88.1</span>
                  </div>

                </div>

                <div className="text-[10px] text-slate-450 leading-relaxed italic bg-slate-900 border border-slate-850 p-2.5 rounded-lg">
                  أينما ذهبت بالخارج، الهاتف يعتبر نفسه مربوطاً مباشرة في السيرفر المحلي في برجك وبسرعة اتصال فائقة جداً.
                </div>
              </div>

              {/* FAQ details */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-850 font-sans border-b border-slate-100 pb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  أسئلة وأسرار متكررة (FAQ):
                </h4>

                <div className="space-y-4 text-xs font-sans">
                  
                  {/* Q1 */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 block">س: هل هذه الخدمات مجانية بالكامل؟</span>
                    <span className="text-slate-500 block leading-relaxed text-[11px]">
                      **ج:** نعم! يوفر Tailscale خدمات مجانية بالكامل لربط ما يصل إلى 100 جهاز بنفس الحساب الشخصي، وهي كافية لربط شبكة برجك بأكملها.
                    </span>
                  </div>

                  {/* Q2 */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 block">س: هل يؤثر الـ VPN على سرعة سحب المستخدمين بالشبكة؟</span>
                    <span className="text-slate-500 block leading-relaxed text-[11px]">
                      **ج:** نهائياً لا! اتصالك عبر الـ VPN يتم استخدامه فقط لإشارات التحكم الدقيقة (سيرفر الـ API والـ Winbox ودخولك للوحة المشرفين)، ولن تمر أحجام سحب وتحميل إنترنت العملاء الخارجي من خلال هذا الـ VPN.
                    </span>
                  </div>

                  {/* Q3 */}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 block">س: هل الدخول بهذه الطريقة أكثر أماناً من الـ Port Forwarding؟</span>
                    <span className="text-slate-500 block leading-relaxed text-[11px]">
                      **ج:** نعم بمليون مرة! عند فتح بورت المايكروتك 8728 أو بورت Winbox 8291 للخارج، سيتعرض السيرفر لمحاولات جارفة للاختراق والهجمات التخمينية (Bruteforce) من قراصنة الـ IP بجميع أنحاء العالم. بينما الـ VPN يخفي أجهزتك بالكامل ويجعلها غير مرئية لأي شخص غير مخول من خلال حسابك!
                    </span>
                  </div>

                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Add node Router Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="font-bold text-base font-sans">ربط ومزامنة جهاز مايكروتك جديد</h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
              
              {/* Server Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم السيرفر المعرّف <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: برج الكرادة - CCR1009"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              {/* IP & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الـ IP الخارجي / المحلي <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.88.1"
                    value={formData.ip}
                    onChange={(e) => setFormData(prev => ({ ...prev, ip: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نفّذ API Port</label>
                  <input
                    type="number"
                    required
                    value={formData.apiPort}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiPort: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* User + pass auth details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (مايكروتك)</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الباسورد السري</label>
                  <input
                    type="password"
                    placeholder="متروك فارغ كخيار"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموضع الجغرافي للبرج (أو الكابينة)</label>
                <input
                  type="text"
                  placeholder="مثال: البصرة، شارع الفراهيدي الثاني"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              {/* Footers buttons */}
              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2 text-sm font-sans">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-semibold shadow-xs"
                >
                  ربط السيرفر آلياً
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
