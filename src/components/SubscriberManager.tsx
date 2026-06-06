import React, { useState, useEffect } from 'react';
import { useSystem } from '../context/SystemContext';
import { Subscriber } from '../types';
import { 
  Search, 
  UserPlus, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Phone, 
  Activity, 
  CreditCard, 
  TrendingUp, 
  Edit, 
  Trash2,
  Lock,
  Unlock,
  Calendar,
  Layers,
  CheckCircle,
  XCircle,
  HelpCircle,
  Shuffle,
  ChevronDown,
  ChevronUp,
  Download,
  UploadCloud,
  Check,
  RefreshCw,
  Sliders,
  MessageSquare,
  ExternalLink,
  Settings,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Send
} from 'lucide-react';

export const SubscriberManager: React.FC = () => {
  const {
    subscribers,
    profiles,
    routers,
    sessions,
    addSubscriber,
    updateSubscriber,
    deleteSubscriber,
    renewSubscriber,
    toggleSubscriberStatus,
    restoreSubscribers,
    currency,
    triggerMockConnection,
    isSyncing,
    apiSyncLogs,
    lastSyncStatus,
    clearApiSyncLogs,
    syncSubscriberToRouter
  } = useSystem();

  // Bulk Control States
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkTargetProfile, setBulkTargetProfile] = useState('');
  const [csvPasteData, setCsvPasteData] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // WhatsApp Notification wizard states
  const { token } = useSystem();
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappTemplate, setWhatsappTemplate] = useState('أهلاً بك عزيزي العميل {fullName}.\nنود تذكيرك بقرب انتهاء اشتراكك في باقة {profileName} (اسم المستخدم: {username}).\nتاريخ انتهاء الاشتراك: {expiryDate}\nالمتبقي لانتهاء الخدمة: {daysLeft} أيام.\nالمبلغ المطلوب للتجديد: {price}.\nيرجى تعبئة الرصيد لتفادي فصل الخدمة. شكراً لاختيارك لنا! ❤️');
  const [whatsappMethod, setWhatsappMethod] = useState<'url_scheme' | 'http_api'>('url_scheme');
  const [whatsappGatewayUrl, setWhatsappGatewayUrl] = useState('https://api.ultramsg.com/instanceXXXXX/messages/chat?token=YOUR_TOKEN&to={phone}&body={message}');
  const [whatsappApiLogs, setWhatsappApiLogs] = useState<{
    name: string;
    username: string;
    phone: string;
    subscriber: any;
    status: 'idle' | 'sending' | 'success' | 'error';
    message?: string;
  }[]>([]);
  const [whatsappSendingInProgress, setWhatsappSendingInProgress] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved WhatsApp configurations from SQLite settings DB
  const loadWhatsAppSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.whatsapp_template) setWhatsappTemplate(data.whatsapp_template);
        if (data.whatsapp_method) setWhatsappMethod(data.whatsapp_method as 'url_scheme' | 'http_api');
        if (data.whatsapp_gateway_url) setWhatsappGatewayUrl(data.whatsapp_gateway_url);
        setSettingsLoaded(true);
      }
    } catch (e) {
      console.error('Failed to load WhatsApp settings:', e);
    }
  };

  // Persist WhatsApp configs in SQLite settings DB
  const saveWhatsAppSettings = async (template: string, method: string, gatewayUrl: string) => {
    if (!token) return;
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: {
            whatsapp_template: template,
            whatsapp_method: method,
            whatsapp_gateway_url: gatewayUrl
          }
        })
      });
    } catch (e) {
      console.error('Failed to save WhatsApp settings:', e);
    }
  };

  // Helper function to draft personalized messages dynamically
  const generateWhatsAppMessage = (sub: Subscriber, templateText: string) => {
    const profile = profiles.find(p => p.id === sub.profileId);
    const router = routers.find(r => r.id === sub.routerId);
    
    const expDate = new Date(sub.expiryDate);
    const daysLeft = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24)));
    const priceFormatted = profile ? formatPrice(profile.price) : '0';

    return templateText
      .replace(/{fullName}/g, sub.fullName)
      .replace(/{name}/g, sub.fullName)
      .replace(/{username}/g, sub.username)
      .replace(/{phone}/g, sub.phone || '')
      .replace(/{profileName}/g, profile?.name || 'الافتراضية')
      .replace(/{packageName}/g, profile?.name || 'الافتراضية')
      .replace(/{expiryDate}/g, expDate.toLocaleDateString('ar-IQ'))
      .replace(/{daysLeft}/g, String(daysLeft))
      .replace(/{price}/g, priceFormatted)
      .replace(/{routerName}/g, router?.name || 'سيرفر تلقائي');
  };

  // Sequentially send automated gateway updates with CORS protection proxy
  const runHttpWhatsappBulkSend = async () => {
    if (whatsappSendingInProgress) return;
    setWhatsappSendingInProgress(true);

    // Persist current settings instantly
    await saveWhatsAppSettings(whatsappTemplate, whatsappMethod, whatsappGatewayUrl);

    // Queue of entries with non-empty phones that aren't already sent successfully
    const queue = whatsappApiLogs.filter(log => log.phone && log.status !== 'success');
    
    for (const item of queue) {
      // Mark as sending
      setWhatsappApiLogs(prev => prev.map(log => log.username === item.username ? { ...log, status: 'sending' } : log));
      
      const draftMessage = generateWhatsAppMessage(item.subscriber, whatsappTemplate);
      
      try {
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            phone: item.phone,
            message: draftMessage,
            gatewayUrl: whatsappGatewayUrl
          })
        });

        if (response.ok) {
          setWhatsappApiLogs(prev => prev.map(log => log.username === item.username ? { ...log, status: 'success', message: 'تم الإرسال بنجاح' } : log));
        } else {
          const errData = await response.json();
          setWhatsappApiLogs(prev => prev.map(log => log.username === item.username ? { ...log, status: 'error', message: errData.error || 'فشل الإرسال' } : log));
        }
      } catch (err: any) {
        setWhatsappApiLogs(prev => prev.map(log => log.username === item.username ? { ...log, status: 'error', message: err.message || 'خطأ اتصال بالشبكة' } : log));
      }
      
      // Spacing throttle flow (500ms) to bypass remote gate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setWhatsappSendingInProgress(false);
  };

  // Advanced CSV Import States
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [filterPreviewStatus, setFilterPreviewStatus] = useState<'all' | 'valid' | 'invalid'>('all');
  const [defaultImportRouterId, setDefaultImportRouterId] = useState('');
  const [defaultImportProfileId, setDefaultImportProfileId] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [importSuccessLogs, setImportSuccessLogs] = useState<string[]>([]);
  const [importStrategy, setImportStrategy] = useState<'add_new' | 'merge_restore' | 'wipe_restore'>('merge_restore');

  // Bulk Operations Handlers
  const handleApplyBulkAction = () => {
    if (selectedSubIds.length === 0) {
      alert('الرجاء تحديد مشترك واحد على الأقل لتطبيق العملية الجماعية.');
      return;
    }
    if (!bulkAction) {
      alert('الرجاء اختيار نوع العملية الجماعية.');
      return;
    }

    if (bulkAction === 'whatsapp') {
      const initialLogs = selectedSubIds.map(id => {
        const sub = subscribers.find(s => s.id === id);
        return {
          name: sub?.fullName || '',
          username: sub?.username || '',
          phone: sub?.phone || '',
          subscriber: sub,
          status: 'idle' as const
        };
      });
      setWhatsappApiLogs(initialLogs);
      setWhatsappModalOpen(true);
      loadWhatsAppSettings();
    } else if (bulkAction === 'delete') {
      if (confirm(`هل أنت متأكد من حذف ${selectedSubIds.length} مستخدم جماعياً؟ سيتم إنهاء كافة جلساتهم وممخطط الأيبات.`)) {
        selectedSubIds.forEach(id => deleteSubscriber(id));
        setSelectedSubIds([]);
        alert('تم حذف المشتركين المحددين جماعياً بنجاح ومزامنة الكوماند مع مايكروتك!');
      }
    } else if (bulkAction === 'renew') {
      let renewedCount = 0;
      selectedSubIds.forEach(id => {
        const sub = subscribers.find(s => s.id === id);
        if (sub) {
          renewSubscriber(id, sub.profileId, 'cash');
          renewedCount++;
        }
      });
      setSelectedSubIds([]);
      alert(`تم تجديد اشتراك ${renewedCount} عملاء بنجاح نقداً وتغذية السيرفر!`);
    } else if (bulkAction === 'profile') {
      const activeProfileId = bulkTargetProfile || profiles[0]?.id;
      if (!activeProfileId) {
        alert('الرجاء تحديد الباقة البديلة قبل النقل.');
        return;
      }
      let modifiedCount = 0;
      selectedSubIds.forEach(id => {
        const sub = subscribers.find(s => s.id === id);
        if (sub) {
          updateSubscriber({ ...sub, profileId: activeProfileId });
          modifiedCount++;
        }
      });
      setSelectedSubIds([]);
      alert(`تم تغيير باقة ${modifiedCount} مستخدمين إلى الباقة الجديدة بنجاح!`);
    } else if (bulkAction === 'toggle') {
      selectedSubIds.forEach(id => {
        toggleSubscriberStatus(id);
      });
      setSelectedSubIds([]);
      alert('تم عكس حالة تمكين/تعطيل الحسابات المحددة ومزامنة الاتصال بالمايكروتك.');
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (subscribers.length === 0) {
      alert('لا يوجد أي مستخدمين لتصديرهم حالياً.');
      return;
    }
    const headers = 'Username,Password,FullName,Phone,IPAddress,MACAddress,ProfileId,RouterId,ExpiryDate,Status,CreatedAt\n';
    const rows = subscribers.map(sub => {
      return `"${sub.username}","${sub.password}","${sub.fullName}","${sub.phone}","${sub.ipAddress || ''}","${sub.macAddress || ''}","${sub.profileId}","${sub.routerId}","${sub.expiryDate}","${sub.status}","${sub.createdAt || ''}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SuperSAS_Subscribers_Backup_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auto-initialize default import options
  React.useEffect(() => {
    if (!defaultImportRouterId && routers.length > 0) {
      setDefaultImportRouterId(routers[0].id);
    }
  }, [routers, defaultImportRouterId]);

  React.useEffect(() => {
    if (!defaultImportProfileId && profiles.length > 0) {
      setDefaultImportProfileId(profiles[0].id);
    }
  }, [profiles, defaultImportProfileId]);

  // CSV Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('يرجى تزويد النظام بملف بصيغة CSV فقط.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvPasteData(text);
      handleAnalyzeCSV(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  // CSV Import Parser & Validator
  const handleAnalyzeCSV = (textToParse: string) => {
    if (!textToParse.trim()) {
      alert('الرجاء كتابة أو لصق بيانات CSV أولاً، أو اختيار ملف.');
      return;
    }

    const lines = textToParse.split('\n');
    const tempRows: any[] = [];
    const lowercaseUsernamesInCSV = new Set<string>();

    lines.forEach((line, index) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      // Skip header row if it contains keywords like Username, user, IP, full, profile, or in Arabic
      if (
        index === 0 &&
        (cleanLine.toLowerCase().includes('username') ||
          cleanLine.toLowerCase().includes('user') ||
          cleanLine.toLowerCase().includes('password') ||
          cleanLine.toLowerCase().includes('full') ||
          cleanLine.toLowerCase().includes('اسم') ||
          cleanLine.toLowerCase().includes('رقم') ||
          cleanLine.toLowerCase().includes('باقة'))
      ) {
        return;
      }

      // Splitting by comma or semicolon, handling quotes correctly
      const parts: string[] = [];
      let currentPart = '';
      let inQuotes = false;
      for (let i = 0; i < cleanLine.length; i++) {
        const char = cleanLine[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          parts.push(currentPart.trim());
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart.trim());

       const username = parts[0] ? parts[0].replace(/"/g, '').trim() : '';
      const password = parts[1] ? parts[1].replace(/"/g, '').trim() : '';
      const fullName = parts[2] ? parts[2].replace(/"/g, '').trim() : '';
      const phone = parts[3] ? parts[3].replace(/"/g, '').trim() : '';
      const ipAddress = parts[4] ? parts[4].replace(/"/g, '').trim() : '';
      const macAddress = parts[5] ? parts[5].replace(/"/g, '').trim() : '';
      const profileInput = parts[6] ? parts[6].replace(/"/g, '').trim() : '';
      const routerInput = parts[7] ? parts[7].replace(/"/g, '').trim() : '';
      const expiryDateInput = parts[8] ? parts[8].replace(/"/g, '').trim() : '';
      const statusInput = parts[9] ? parts[9].replace(/"/g, '').trim() : '';
      const createdAtInput = parts[10] ? parts[10].replace(/"/g, '').trim() : '';

      const errors: string[] = [];

      // Username Validation
      if (!username) {
        errors.push('اسم المستخدم مطلوب.');
      } else {
        const usernameRegex = /^[a-zA-Z0-9_\.\-\@]+$/;
        if (!usernameRegex.test(username)) {
          errors.push('اسم المستخدم غير صالح: يجب أن يحتوي على أحرف إنجليزية وأرقام وعلامات . - _ @ فقط وبدون فراغات.');
        }
        if (username.length < 3) {
          errors.push('اسم المستخدم قصير جداً (يجب أن يكون 3 أحرف على الأقل).');
        }
        const isSystemDup = subscribers.some(s => s.username.toLowerCase() === username.toLowerCase());
        if (isSystemDup && importStrategy === 'add_new') {
          errors.push('اسم المستخدم موجود مسبقاً في قاعدة بيانات المشتركين.');
        }
        if (lowercaseUsernamesInCSV.has(username.toLowerCase())) {
          errors.push('اسم المستخدم مكرر في أسطر الملف الحالي.');
        } else {
          lowercaseUsernamesInCSV.add(username.toLowerCase());
        }
      }

      // Password Validation
      if (!password) {
        errors.push('كلمة المرور مطلوبة.');
      } else if (password.length < 3) {
        errors.push('كلمة المرور قصيرة جداً (أقل من 3 رموز).');
      }

      // FullName Validation
      if (!fullName) {
        errors.push('اسم المشترك الكامل مطلوب.');
      } else if (fullName.length < 3) {
        errors.push('الاسم الكامل يجب أن يكون 3 رموز على الأقل.');
      }

      // IP Validation
      if (ipAddress) {
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(ipAddress)) {
          errors.push('تنسيق عنوان IP غير صالح (مثل 10.0.0.50).');
        }
      }

      // MAC Validation
      let formattedMac = macAddress;
      if (macAddress) {
        const cleanedMac = macAddress.replace(/[^a-fA-F0-9]/g, '');
        if (cleanedMac.length === 12) {
          const matched = cleanedMac.match(/.{1,2}/g);
          if (matched) {
            formattedMac = matched.join(':').toUpperCase();
          }
        }
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(formattedMac)) {
          errors.push('تنسيق العنوان الفعلي (MAC) غير صالح (مثل AA:BB:CC:DD:EE:FF).');
        }
      }

      // Profile Mapping
      let matchedProfileId = '';
      if (profileInput) {
        const found = profiles.find(p => p.id === profileInput || p.name.toLowerCase() === profileInput.toLowerCase());
        if (found) {
          matchedProfileId = found.id;
        } else {
          errors.push(`الباقة "${profileInput}" غير معروفة في النظام.`);
        }
      }

      // Router Mapping
      let matchedRouterId = '';
      if (routerInput) {
        const found = routers.find(r => r.id === routerInput || r.name.toLowerCase() === routerInput.toLowerCase() || r.ip === routerInput);
        if (found) {
          matchedRouterId = found.id;
        } else {
          errors.push(`الراوتر "${routerInput}" غير معروف في النظام.`);
        }
      }

      tempRows.push({
        id: `row-${index}`,
        username,
        password,
        fullName,
        phone,
        ipAddress,
        macAddress: formattedMac,
        profileInput,
        routerInput,
        matchedProfileId,
        matchedRouterId,
        expiryDate: expiryDateInput || null,
        status: statusInput || null,
        createdAt: createdAtInput || null,
        isValid: errors.length === 0,
        errors
      });
    });

    setPreviewRows(tempRows);
    setImportSuccessLogs([]);
    setImportStatus(`تحليل ناجح! تم فحص ${tempRows.length} أسطر من البيانات بنجاح.`);
  };

  // CSV Import Action Handler (Saves & Autocalls API Sync)
  const handleImportCSV = () => {
    const validRows = previewRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('لا توجد أي حسابات صالحة في المعاينة للاستيراد حالياً. يرجى تعديل أخطاء أسطر الـ CSV أولاً.');
      return;
    }

    const targetRouter = defaultImportRouterId || routers[0]?.id || '';
    const targetProfile = defaultImportProfileId || profiles[0]?.id || '';

    if (!targetRouter || !targetProfile) {
      alert('يرجى التأكد من توفر راوتر وباقة واحدة على الأقل في النظام.');
      return;
    }

    let successCount = 0;
    const tempLogs: string[] = [];

    if (importStrategy === 'wipe_restore' || importStrategy === 'merge_restore') {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);

      // Map rows into real subscriber objects
      const importedSubsList: Subscriber[] = validRows.map((row, idx) => {
        const selectedRouterId = row.matchedRouterId || targetRouter;
        const selectedProfileId = row.matchedProfileId || targetProfile;

        // Try parsing expiry date safely
        let expVal = row.expiryDate;
        if (!expVal) {
          expVal = defaultExpiry.toISOString();
        } else {
          try {
            const d = new Date(expVal);
            if (!isNaN(d.getTime())) {
              expVal = d.toISOString();
            } else {
              expVal = defaultExpiry.toISOString();
            }
          } catch(e) {
            expVal = defaultExpiry.toISOString();
          }
        }

        // Try parsing status
        const rawStatus = String(row.status || 'active').toLowerCase().trim();
        const finalStatus = (rawStatus === 'active' || rawStatus === 'expired' || rawStatus === 'disabled') ? rawStatus : 'active';

        // Try parsing createdAt
        let createdVal = row.createdAt;
        if (!createdVal) {
          createdVal = new Date().toISOString();
        } else {
          try {
            const d = new Date(createdVal);
            if (!isNaN(d.getTime())) {
              createdVal = d.toISOString();
            } else {
              createdVal = new Date().toISOString();
            }
          } catch(e) {
            createdVal = new Date().toISOString();
          }
        }

        return {
          id: `sub-${Date.now()}-${idx}`,
          username: row.username,
          password: row.password,
          fullName: row.fullName,
          phone: row.phone || '',
          routerId: selectedRouterId,
          profileId: selectedProfileId,
          ipAddress: row.ipAddress || undefined,
          macAddress: row.macAddress || undefined,
          status: finalStatus,
          createdAt: createdVal,
          expiryDate: expVal
        };
      });

      if (importStrategy === 'wipe_restore') {
        restoreSubscribers(importedSubsList);
        successCount = importedSubsList.length;
        tempLogs.push(`🧹 تم مسح قاعدة بيانات المشتركين السابقة بنجاح.`);
        tempLogs.push(`📥 تم تعبئة واستعادة ${successCount} مشترك من ملف الباك اب بنجاح.`);
      } else {
        // Merge Restore
        const updatedList = [...subscribers];
        importedSubsList.forEach(newSub => {
          const existingIdx = updatedList.findIndex(s => s.username.toLowerCase() === newSub.username.toLowerCase());
          if (existingIdx !== -1) {
            updatedList[existingIdx] = {
              ...updatedList[existingIdx],
              ...newSub,
              id: updatedList[existingIdx].id // Keep original subscriber ID
            };
            tempLogs.push(`🔄 تم تحديث الحساب المكرر [${newSub.username}] وتثبيت تواريخ صلاحتيه السابقة.`);
          } else {
            updatedList.push(newSub);
            tempLogs.push(`➕ تم إدراج حساب جديد [${newSub.username}] من الباك اب.`);
          }
          successCount++;
        });
        restoreSubscribers(updatedList);
      }
    } else {
      // Standard 'add_new' where we generate brand new 30 days subscriptions
      validRows.forEach(row => {
        const selectedRouterId = row.matchedRouterId || targetRouter;
        const selectedProfileId = row.matchedProfileId || targetProfile;

        // Add subscriber (which schedules live API sync automatically)
        addSubscriber({
          username: row.username,
          password: row.password,
          fullName: row.fullName,
          phone: row.phone || '',
          routerId: selectedRouterId,
          profileId: selectedProfileId,
          ipAddress: row.ipAddress || undefined,
          macAddress: row.macAddress || undefined
        });

        successCount++;
        tempLogs.push(`✅ تم استيراد اليوزر الجديد [${row.username}] وبدء المزامنة مع سيرفر المايكروتك.`);
      });
    }

    setImportSuccessLogs(tempLogs);
    setPreviewRows([]);
    setCsvPasteData('');
    setImportStatus(`اكتملت العملية بنجاح لـ ${successCount} مشترك!`);
    alert(`تمت معالجة البيانات واستيراد ${successCount} مشترك بنجاح طبقاً لإستراتيجيتك المختارة!`);
  };

  const handleClearPreview = () => {
    setPreviewRows([]);
    setCsvPasteData('');
    setImportStatus('');
    setImportSuccessLogs([]);
  };

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickTab, setQuickTab] = useState<'all' | 'active' | 'expired' | 'connected' | 'expired_29_plus' | 'expiring_3_days'>('all');

  // Modals controllers
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);

  // Selected entities for edit/renew
  const [selectedSub, setSelectedSub] = useState<Subscriber | null>(null);

  // MAC dynamic custom modal states
  const [macModalSub, setMacModalSub] = useState<Subscriber | null>(null);
  const [macActionType, setMacActionType] = useState<'lock' | 'unlock' | 'error' | null>(null);
  const [macInputValue, setMacInputValue] = useState('');
  const [macErrorMessage, setMacErrorMessage] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    routerId: '',
    profileId: '',
    ipAddress: '',
    macAddress: '',
    whatsappAlertMode: 'auto' as 'auto' | 'manual'
  });

  const [renewData, setRenewData] = useState({
    profileId: '',
    paymentMethod: 'cash' as 'cash' | 'card',
    cardPin: '',
    durationOption: 'default' as 'default' | 'one_hour' | 'two_hours' | 'four_hours'
  });

  const [renewError, setRenewError] = useState('');
  const [renewSuccess, setRenewSuccess] = useState('');
  const [renewalSuccessData, setRenewalSuccessData] = useState<{
    subscriberName: string;
    profileName: string;
    duration: string;
    paymentMethod: string;
    expiryDate: string;
  } | null>(null);

  // Auto Generater helper for usernames
  const generateRandomUserAndPass = () => {
    const prefixes = ['ali', 'omr', 'hsn', 'noor', 'iq_net', 'client', 'usr'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum1 = Math.floor(100 + Math.random() * 900);
    const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
    
    setFormData(prev => ({
      ...prev,
      username: `${randomPrefix}_${randomNum1}`,
      password: randomPass
    }));
  };

  const generateRandomMac = () => {
    const blocks = Array.from({ length: 6 }, () => {
      const hex = Math.floor(Math.random() * 256).toString(16).toUpperCase();
      return hex.length === 1 ? '0' + hex : hex;
    });
    setFormData(prev => ({
      ...prev,
      macAddress: blocks.join(':')
    }));
  };

  const handleOpenAdd = () => {
    // defaults
    setFormData({
      username: '',
      password: '',
      fullName: '',
      phone: '',
      routerId: routers[0]?.id || '',
      profileId: profiles[0]?.id || '',
      ipAddress: '',
      macAddress: '',
      whatsappAlertMode: 'auto'
    });
    setAddModalOpen(true);
  };

  const handleOpenEdit = (sub: Subscriber) => {
    setSelectedSub(sub);
    setFormData({
      username: sub.username,
      password: sub.password,
      fullName: sub.fullName,
      phone: sub.phone,
      routerId: sub.routerId,
      profileId: sub.profileId,
      ipAddress: sub.ipAddress || '',
      macAddress: sub.macAddress || '',
      whatsappAlertMode: sub.whatsappAlertMode || 'auto'
    });
    setEditModalOpen(true);
  };

  const handleOpenRenew = (sub: Subscriber) => {
    setSelectedSub(sub);
    setRenewData({
      profileId: sub.profileId,
      paymentMethod: 'cash',
      cardPin: ''
    });
    setRenewError('');
    setRenewSuccess('');
    setRenewModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.fullName) {
      alert('الرجاء تعبئة الحقول الأساسية المطلوبة.');
      return;
    }
    
    // Check duplicity
    if (subscribers.some(s => s.username.toLowerCase() === formData.username.toLowerCase())) {
      alert('خطأ: اسم خدمة PPPoE مكرر وموجود بالفعل مسبقاً.');
      return;
    }

    addSubscriber({
      username: formData.username,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      routerId: formData.routerId,
      profileId: formData.profileId,
      ipAddress: formData.ipAddress || undefined,
      macAddress: formData.macAddress || undefined,
      whatsappAlertMode: formData.whatsappAlertMode
    });

    setAddModalOpen(false);
    
    // Auto simulate connection
    triggerMockConnection(formData.username);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    if (!formData.fullName || !formData.password) {
      alert('الرجاء كتابة اسم العميل وكلمة مرور الخدمة.');
      return;
    }

    updateSubscriber({
      ...selectedSub,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      routerId: formData.routerId,
      profileId: formData.profileId,
      ipAddress: formData.ipAddress || undefined,
      macAddress: formData.macAddress || undefined,
      whatsappAlertMode: formData.whatsappAlertMode
    });

    setEditModalOpen(false);
  };

  const handleSendManualWhatsApp = async (sub: Subscriber) => {
    if (!sub.phone) {
      alert('العميل ليس لديه رقم هاتف مسجل للواتس اب.');
      return;
    }
    
    // Generate draft using existing template
    const draftMessage = generateWhatsAppMessage(sub, whatsappTemplate);
    
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          phone: sub.phone,
          message: draftMessage,
          gatewayUrl: whatsappGatewayUrl
        })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        alert(`تم إرسال رسالة تنبية انتهاء الاشتراك إلى المشترك "${sub.fullName}" بنجاح عبر الواتساب!`);
      } else {
        alert(`فشل الإرسال: ${data.message || data.error || 'خطأ غير معروف في السيرفر.'}`);
      }
    } catch (err: any) {
      alert('خطأ في الاتصال أثناء إرسال الرسالة: ' + err.message);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setRenewError('');
    setRenewSuccess('');

    const profile = profiles.find(p => p.id === renewData.profileId);
    let hrs: number | undefined = undefined;
    let durationText = '';
    if (renewData.durationOption === 'one_hour') {
      hrs = 1;
      durationText = 'ساعة واحدة';
    } else if (renewData.durationOption === 'two_hours') {
      hrs = 2;
      durationText = 'ساعتان (2)';
    } else if (renewData.durationOption === 'four_hours') {
      hrs = 4;
      durationText = '4 ساعات';
    } else {
      durationText = profile ? `${profile.validityDays} يوم (كامل الباقة)` : 'كامل الباقة';
    }

    const res = await renewSubscriber(
      selectedSub.id,
      renewData.profileId,
      renewData.paymentMethod,
      renewData.cardPin,
      hrs
    );

    if (res.success) {
      setRenewSuccess(res.message);
      
      const currentExpiry = new Date(selectedSub.expiryDate);
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate);
      if (hrs) {
        newExpiry.setHours(baseDate.getHours() + hrs);
      } else if (profile) {
        newExpiry.setDate(baseDate.getDate() + profile.validityDays);
      }
      
      const formattedExpiry = newExpiry.toLocaleString('ar-YE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      setRenewalSuccessData({
        subscriberName: selectedSub.fullName || selectedSub.username,
        profileName: profile ? profile.name : 'غير معروف',
        duration: durationText,
        paymentMethod: renewData.paymentMethod === 'cash' ? '💵 تسديد نقدي (كاش)' : '💳 كرت شحن (PIN)',
        expiryDate: formattedExpiry
      });

      setTimeout(() => {
        setRenewModalOpen(false);
        setRenewSuccess('');
      }, 1000);
    } else {
      setRenewError(res.message);
    }
  };

  const handleMacModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macModalSub) return;

    if (macActionType === 'unlock') {
      try {
        await updateSubscriber({ ...macModalSub, macAddress: '' });
        setMacActionType(null);
        setMacModalSub(null);
      } catch (err: any) {
        setMacErrorMessage(err.message || 'حدث خطأ أثناء فك قفل الماك.');
      }
    } else if (macActionType === 'lock') {
      const cleanedMac = macInputValue.replace(/[^a-fA-F0-9]/g, '');
      let formattedMac = macInputValue.trim();
      
      if (cleanedMac.length === 12) {
        const matched = cleanedMac.match(/.{1,2}/g);
        if (matched) {
          formattedMac = matched.join(':').toUpperCase();
        }
      } else {
        formattedMac = formattedMac.toUpperCase();
      }

      if (!formattedMac) {
        setMacErrorMessage('الرجاء إدخال عنوان MAC صحيح.');
        return;
      }

      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(formattedMac)) {
        setMacErrorMessage('تنسيق عنوان الماك غير صالح (مثال AA:BB:CC:DD:EE:FF).');
        return;
      }

      try {
        await updateSubscriber({ ...macModalSub, macAddress: formattedMac });
        setMacActionType(null);
        setMacModalSub(null);
      } catch (err: any) {
        setMacErrorMessage(err.message || 'حدث خطأ أثناء قفل الماك.');
      }
    }
  };

  // Filtration logic
  const now = new Date();
  const twentyNineDaysInMs = 29 * 24 * 60 * 60 * 1000;
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch = 
      sub.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      sub.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.phone.includes(searchQuery);

    const matchesProfile = profileFilter === 'all' || sub.profileId === profileFilter;
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;

    let matchesTab = true;
    if (quickTab === 'active') {
      matchesTab = sub.status === 'active';
    } else if (quickTab === 'expired') {
      matchesTab = sub.status === 'expired';
    } else if (quickTab === 'connected') {
      matchesTab = sessions.some(session => session.username === sub.username);
    } else if (quickTab === 'expired_29_plus') {
      const expDate = new Date(sub.expiryDate);
      matchesTab = (sub.status === 'expired') && (now.getTime() - expDate.getTime() > twentyNineDaysInMs);
    } else if (quickTab === 'expiring_3_days') {
      const expDate = new Date(sub.expiryDate);
      const timeLeft = expDate.getTime() - now.getTime();
      matchesTab = (sub.status === 'active') && (timeLeft > 0) && (timeLeft <= threeDaysInMs);
    }

    return matchesSearch && matchesProfile && matchesStatus && matchesTab;
  });

  const getProfileName = (id: string) => {
    return profiles.find(p => p.id === id)?.name || 'باقة غير معينة';
  };

  const getRouterName = (id: string) => {
    return routers.find(r => r.id === id)?.name || 'سيرفر عام';
  };

  const formatPrice = (val: number) => {
    if (currency === 'IQD') {
      return `${val.toLocaleString('ar-IQ')} د.ع`;
    }
    return `$${Math.round(val / 1480)}`;
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Sub Title Block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans">إدارة مشتركي PPPoE</h2>
          <p className="text-xs text-slate-500 mt-0.5">تسجيل العملاء، تحديد باقات السرعة، قفل الماك وتجديد الاشتراك الشهري بالشبكة.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkPanelOpen(!bulkPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold select-none transition-all cursor-pointer ${
              bulkPanelOpen
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-600" />
            {bulkPanelOpen ? 'إغلاق لوحة العمليات الجماعية' : 'عرض لوحة العمليات جماعياً والاستيراد'}
          </button>
          
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 cursor-pointer select-none"
          >
            <UserPlus className="w-4 h-4 text-white" />
            تسجيل عميل جديد
          </button>
        </div>
      </div>

      {/* MikroTik Real-time API Sync Log Console */}
      {apiSyncLogs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 text-slate-100 p-4 rounded-2xl shadow-xl space-y-3 font-mono text-xs overflow-hidden leading-relaxed text-right" dir="rtl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isSyncing 
                  ? 'bg-blue-400 animate-pulse' 
                  : lastSyncStatus === 'success' 
                    ? 'bg-emerald-400 font-bold' 
                    : lastSyncStatus === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
              }`} />
              <span className="font-sans font-bold text-slate-200 text-sm">
                لوحة ربط ومزامنة API MicroTik الفورية
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={clearApiSyncLogs}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded-lg font-sans transition-all cursor-pointer"
              >
                مسح السجلات
              </button>
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {apiSyncLogs.map((logLine, index) => {
              let color = 'text-slate-300';
              if (logLine.includes('✅') || logLine.includes('نجح')) color = 'text-emerald-400 font-medium';
              else if (logLine.includes('❌') || logLine.includes('فشل')) color = 'text-rose-400 font-semibold';
              else if (logLine.includes('⚠️')) color = 'text-amber-400';
              else if (logLine.includes('⏳') || logLine.includes('بدأت') || logLine.includes('جاري')) color = 'text-blue-400 animate-pulse';
              else if (logLine.includes('🔌') || logLine.includes('تعطيل') || logLine.includes('تمكين')) color = 'text-purple-300';
              else if (logLine.includes('🔍') || logLine.includes('البحث') || logLine.includes('الاستعلام')) color = 'text-sky-300';
              
              return (
                <div key={index} className="flex items-start gap-1 p-1 rounded-sm hover:bg-slate-800/40">
                  <span className="text-[10px] text-slate-500 select-none">[{index + 1}]</span>
                  <p className={`flex-1 whitespace-pre-wrap text-[11px] ${color}`}>{logLine}</p>
                </div>
              );
            })}
          </div>
          <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="text-[10.5px] text-slate-400 font-sans">
              * يقوم النظام بمخاطبة REST API لراوتر مايكروتك (v7+) لتمكين وإنشاء وتعديل وحظر يوزرات الـ PPPoE Secrets فوراً.
            </div>
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-[10.5px] text-blue-400 font-sans animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                جاري إرسال الإجراء...
              </span>
            )}
          </div>
        </div>
      )}

      {/* ACCORDION BULK PANEL (Feature 2) */}
      {bulkPanelOpen && (
        <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-5 animate-in fade-in duration-200 text-xs text-right">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Section A: Bulk Operations */}
            <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-4 shadow-xs">
              <h4 className="font-bold text-slate-800 font-sans flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                التحكم والعمليات الجماعية على المشتركين المحددين ({selectedSubIds.length})
              </h4>
              <p className="text-[11px] text-slate-400">حدد المشتركين من جدول البيانات أدناه أولاً عن طريق إشارة الصح (✓)، ثم اختر أحد الإجراءات الموحدة لتطبيقها بضغطة زر واحدة.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اختر نوع الإجراء الجماعي</label>
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer font-sans"
                  >
                    <option value="">-- حدد إجراءً موحداً --</option>
                    <option value="whatsapp">إرسال تنبيه انتهاء الاشتراك (واتساب) 💬</option>
                    <option value="renew">تجديد الاشتراك جماعياً (نقداً)</option>
                    <option value="profile">تغيير الباقة والسرعة جماعياً</option>
                    <option value="toggle">عكس الحالة (تمكين/حظر) جماعياً</option>
                    <option value="delete">حذف الحسابات المحددة جماعياً</option>
                  </select>
                </div>

                {bulkAction === 'profile' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">حدد باقة الترحيل المستهدفة</label>
                    <select
                      value={bulkTargetProfile}
                      onChange={(e) => setBulkTargetProfile(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer font-sans"
                    >
                      <option value="">-- حدد الباقة المتاحة --</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedSubIds([])}
                  className="px-3 py-1.5 bg-slate-100 text-slate-650 hover:bg-slate-200 rounded-lg font-bold"
                >
                  إلغاء تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkAction}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                >
                  تنفيذ الإجراء الجماعي الآن
                </button>
              </div>
            </div>

            {/* Section B: Import/Export Accounts */}
            <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-4 shadow-xs">
              <div className="flex justify-between items-center text-slate-800 font-bold font-sans">
                <h4 className="flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  استيراد وتصدير قاعدة الحسابات PPPoE
                </h4>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير كـ CSV BACKUP
                </button>
              </div>

              {/* استراتيجية الاستيراد والنسخ الاحتياطي */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 space-y-1.5 text-right">
                <span className="block text-[11px] font-bold text-slate-700">إستراتيجية معالجة ملف الاسترداد / الباك اب:</span>
                <div className="grid grid-cols-1 gap-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[10.5px] text-slate-650 hover:text-slate-800">
                    <input 
                      type="radio" 
                      name="importStrategy" 
                      value="merge_restore" 
                      checked={importStrategy === 'merge_restore'} 
                      onChange={() => {
                        setImportStrategy('merge_restore');
                        handleClearPreview();
                      }}
                      className="accent-indigo-600 cursor-pointer"
                    />
                    <span>🔄 دمج وتحديث الحسابات المشتركة (Merge & Update) - يحافظ على تواريخ الانتهاء السابقة</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer text-[10.5px] text-slate-650 hover:text-slate-800">
                    <input 
                      type="radio" 
                      name="importStrategy" 
                      value="wipe_restore" 
                      checked={importStrategy === 'wipe_restore'} 
                      onChange={() => {
                        setImportStrategy('wipe_restore');
                        handleClearPreview();
                      }}
                      className="accent-rose-600 cursor-pointer"
                    />
                    <span className="text-rose-700 font-semibold">🧹 استعادة نظيفة (Wipe & Restore) - مسح المشتركين الحاليين واسترجاع الباك اب كاملاً بدقة</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[10.5px] text-slate-650 hover:text-slate-800">
                    <input 
                      type="radio" 
                      name="importStrategy" 
                      value="add_new" 
                      checked={importStrategy === 'add_new'} 
                      onChange={() => {
                        setImportStrategy('add_new');
                        handleClearPreview();
                      }}
                      className="accent-emerald-650 cursor-pointer"
                    />
                    <span>➕ تسجيل جديد كلياً (New Bulk Upload) - يولد +30 يوماً وتاريخ انتهاء جديد من اليوم</span>
                  </label>
                </div>
              </div>

              {/* Drag & Drop File Zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                  dragActive 
                    ? "border-emerald-500 bg-emerald-50/50" 
                    : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50/30"
                }`}
              >
                <input 
                  type="file" 
                  id="csv-file-upload-accordion" 
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden" 
                />
                <label htmlFor="csv-file-upload-accordion" className="cursor-pointer flex flex-col items-center justify-center space-y-1">
                  <UploadCloud className="w-7 h-7 text-slate-400 stroke-1.5 animate-bounce animate-duration-3000" />
                  <span className="text-xs font-bold text-slate-700">اسحب ملف CSV وأفلته هنا، أو تصفح المجلدات</span>
                  <span className="text-[9.5px] text-slate-400">مثال: Username,Password,FullName,Phone,IPAddress,MACAddress</span>
                </label>
              </div>
              
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500">أو الصق البيانات يدوياً كـ CSV أسطر:</span>
                  {csvPasteData && (
                    <button 
                      type="button" 
                      onClick={handleClearPreview}
                      className="text-[9.5px] text-rose-600 font-bold hover:underline"
                    >
                      تفريغ البيانات
                    </button>
                  )}
                </div>
                <textarea
                  value={csvPasteData}
                  onChange={(e) => setCsvPasteData(e.target.value)}
                  placeholder="ali_500,123456,علي حسين فاضل,07701234567,10.10.10.22,AA:BB:CC:DD:EE:11"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] outline-hidden focus:bg-white resize-none"
                />
                
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10.5px] font-semibold text-slate-600 leading-tight">
                    {importStatus || "ملاحظة: يمكنك فصل الحقول بفاصلة (,) أو فاصلة منقوطة (;)."}
                  </span>
                  {!previewRows.length && csvPasteData.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzeCSV(csvPasteData)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10.5px] font-bold transition-all shadow-xs cursor-pointer"
                    >
                      تحليل البيانات ومعاينتها
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Section C: Advanced CSV Interactive Validation Report Console */}
          {previewRows.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-150 space-y-4 shadow-sm animate-in slide-in-from-top-4 duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm font-sans flex items-center gap-1.5">
                    <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    تقرير مراجعة والتحقق من المشتركين المكتشفين ({previewRows.length})
                  </h4>
                  <p className="text-[10.5px] text-slate-500">يرجى فحص المشتركين وتأكيد الحالات. سيقوم النظام بمزامنة الحسابات الصالحة فورياً مع سيرفر مايكروتك.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Default Plan Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600">الباقة الافتراضية للغياب:</span>
                    <select
                      value={defaultImportProfileId}
                      onChange={(e) => setDefaultImportProfileId(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] font-sans cursor-pointer"
                    >
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.rateLimit})</option>
                      ))}
                    </select>
                  </div>

                  {/* Default Router Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-600">الراوتر الافتراضي:</span>
                    <select
                      value={defaultImportRouterId}
                      onChange={(e) => setDefaultImportRouterId(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] font-sans cursor-pointer"
                    >
                      {routers.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Validation Summary Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <div className="text-center p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="block text-slate-400 text-[10px] font-bold mb-0.5">إجمالي الأسطر</span>
                  <span className="text-sm font-black text-slate-700 font-mono">{previewRows.length}</span>
                </div>
                <div className="text-center p-2 bg-emerald-50/50 rounded-lg border border-emerald-100 shadow-2xs">
                  <span className="block text-emerald-600 text-[10px] font-bold mb-0.5">مشتركين جاهزين صالحين</span>
                  <span className="text-sm font-black text-emerald-800 font-mono">{previewRows.filter(r => r.isValid).length}</span>
                </div>
                <div className="text-center p-2 bg-rose-50/50 rounded-lg border border-rose-100 shadow-2xs">
                  <span className="block text-rose-600 text-[10px] font-bold mb-0.5 font-sans">سجلات تحتوي معلومات خاطئة</span>
                  <span className="text-sm font-black text-rose-800 font-mono">{previewRows.filter(r => !r.isValid).length}</span>
                </div>
                <div className="text-center p-2 bg-blue-50/50 rounded-lg border border-blue-100 shadow-2xs">
                  <span className="block text-blue-600 text-[10px] font-bold mb-0.5">طريقة الحماية والربط</span>
                  <span className="text-xs font-bold text-blue-800">تحديث فوري REST API</span>
                </div>
              </div>

              {/* View filter controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500">تصفية العرض:</span>
                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('all')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      filterPreviewStatus === 'all' 
                        ? 'bg-slate-700 text-white' 
                        : 'bg-white text-slate-650 hover:bg-slate-100 border border-slate-150'
                    }`}
                  >
                    عرض الكل ({previewRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('valid')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      filterPreviewStatus === 'valid' 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-white text-slate-650 hover:bg-slate-100 border border-slate-150'
                    }`}
                  >
                    الصالحين فقط ({previewRows.filter(r => r.isValid).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterPreviewStatus('invalid')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      filterPreviewStatus === 'invalid' 
                        ? 'bg-rose-600 text-white' 
                        : 'bg-white text-slate-650 hover:bg-slate-100 border border-slate-150'
                    }`}
                  >
                    الأخطاء فقط ({previewRows.filter(r => !r.isValid).length})
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClearPreview}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold rounded-lg cursor-pointer"
                  >
                    إلغاء المعاينة
                  </button>
                  <button
                    type="button"
                    onClick={handleImportCSV}
                    disabled={previewRows.filter(r => r.isValid).length === 0}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[10.5px] font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    استيراد ومزامنة المشتركين الصالحين بقوة ({previewRows.filter(r => r.isValid).length})
                  </button>
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-slate-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-right text-[11px] leading-normal font-sans">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">#</th>
                      <th className="px-3 py-2">اليوزر (PPPoE Secret)</th>
                      <th className="px-3 py-2">الباسورد</th>
                      <th className="px-3 py-2">الاسم الكامل للمشترك</th>
                      <th className="px-3 py-2">رقم الهاتف</th>
                      <th className="px-3 py-2">عنوان IP الثابت</th>
                      <th className="px-3 py-2">الماك (Caller ID)</th>
                      <th className="px-3 py-2">الباقة والراوتر الموجهين</th>
                      <th className="px-3 py-2 text-center w-40">صحة البيانات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows
                      .filter(row => {
                        if (filterPreviewStatus === 'valid') return row.isValid;
                        if (filterPreviewStatus === 'invalid') return !row.isValid;
                        return true;
                      })
                      .map((row, idx) => (
                        <tr key={row.id} className={`hover:bg-slate-50/50 transition-colors ${!row.isValid ? 'bg-rose-50/20' : ''}`}>
                          <td className="px-3 py-2 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-bold font-mono text-slate-850">{row.username || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{row.password || '—'}</td>
                          <td className="px-3 py-2 font-bold text-slate-700">{row.fullName || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{row.phone || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{row.ipAddress || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{row.macAddress || '—'}</td>
                          <td className="px-3 py-2 space-y-0.5">
                            <span className="block text-[9.5px] text-slate-500">
                              باقة: <strong className="text-slate-700 font-sans">{row.matchedProfileId ? profiles.find(p => p.id === row.matchedProfileId)?.name : `الافتراضية (${profiles.find(p => p.id === defaultImportProfileId)?.name || 'Default'})`}</strong>
                            </span>
                            <span className="block text-[9.5px] text-slate-500">
                              سيرفر: <strong className="text-slate-700 font-sans">{row.matchedRouterId ? routers.find(r => r.id === row.matchedRouterId)?.name : `الافتراضي (${routers.find(r => r.id === defaultImportRouterId)?.name || 'Default'})`}</strong>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9.5px] font-bold">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                جاهز وصالح
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9.5px] font-bold">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  بيانات معطوبة
                                </span>
                                <div className="text-[9px] text-rose-600 text-right space-y-0.5 leading-relaxed font-sans">
                                  {row.errors.map((err: string, eIdx: number) => (
                                    <div key={eIdx}>• {err}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Import Logs Console */}
          {importSuccessLogs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 text-slate-100 p-4 rounded-xl shadow-inner space-y-2 font-mono text-[10.5px] overflow-hidden leading-relaxed text-right">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 mb-1.5">
                <span className="font-sans font-bold text-slate-200 text-xs flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  سجل الاستجابة للاستيراد الفوري للـ Secrets في MikroTik
                </span>
                <button 
                  type="button" 
                  onClick={() => setImportSuccessLogs([])} 
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded text-[9px] text-slate-350 cursor-pointer"
                >
                  مسح السجل
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {importSuccessLogs.map((log, index) => (
                  <div key={index} className="text-emerald-400 font-medium">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* لوحة عرض وفرز الحالات السريعة (المنتهين، الفعالين، المتصلين، متأخرين) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* جميع المشتركين */}
        <button
          type="button"
          onClick={() => {
            setQuickTab('all');
            setStatusFilter('all');
          }}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden select-none ${
            quickTab === 'all'
              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white border-slate-150 hover:border-slate-305 text-slate-800 shadow-xs hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10.5px] font-bold ${quickTab === 'all' ? 'text-blue-100' : 'text-slate-450'}`}>كل المشتركين</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] uppercase font-bold font-mono ${quickTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
              ALL
            </span>
          </div>
          <div className="text-2xl font-black font-mono mt-2">{subscribers.length}</div>
          <div className={`text-[10px] mt-1 ${quickTab === 'all' ? 'text-blue-200' : 'text-slate-400'}`}>مستودع المشتركين الكلي</div>
        </button>

        {/* الفعالين بالخدمة */}
        <button
          type="button"
          onClick={() => {
            setQuickTab('active');
            setStatusFilter('all');
          }}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden select-none ${
            quickTab === 'active'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white border-slate-150 hover:border-slate-305 text-slate-800 shadow-xs hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10.5px] font-bold ${quickTab === 'active' ? 'text-emerald-100' : 'text-slate-450'}`}>الفعالين بالخدمة</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${quickTab === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
              ACTIVE
            </span>
          </div>
          <div className="text-2xl font-black font-mono mt-2">
            {subscribers.filter(s => s.status === 'active').length}
          </div>
          <div className={`text-[10px] mt-1 ${quickTab === 'active' ? 'text-emerald-200' : 'text-slate-400'}`}>اشتراكات واصلة وغير منتهية</div>
        </button>

        {/* المنتهين */}
        <button
          type="button"
          onClick={() => {
            setQuickTab('expired');
            setStatusFilter('all');
          }}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden select-none ${
            quickTab === 'expired'
              ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-white border-slate-150 hover:border-slate-305 text-slate-800 shadow-xs hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10.5px] font-bold ${quickTab === 'expired' ? 'text-amber-100' : 'text-slate-450'}`}>المنتهية اشتراكاتهم</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${quickTab === 'expired' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'}`}>
              EXPIRED
            </span>
          </div>
          <div className="text-2xl font-black font-mono mt-2">
            {subscribers.filter(s => s.status === 'expired').length}
          </div>
          <div className={`text-[10px] mt-1 ${quickTab === 'expired' ? 'text-amber-200' : 'text-slate-400'}`}>الإنترنت مقطوع تلقائياً</div>
        </button>

        {/* المتصلين حالياً */}
        <button
          type="button"
          onClick={() => {
            setQuickTab('connected');
            setStatusFilter('all');
          }}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden select-none ${
            quickTab === 'connected'
              ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-white border-slate-150 hover:border-slate-305 text-slate-800 shadow-xs hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10.5px] font-bold ${quickTab === 'connected' ? 'text-purple-100' : 'text-slate-450'}`}>المتصلين حالياً (PPPoE)</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${quickTab === 'connected' ? 'bg-white/20 text-white animate-pulse' : 'bg-purple-50 text-purple-700'}`}>
              LIVE
            </span>
          </div>
          <div className="text-2xl font-black font-mono mt-2">
            {subscribers.filter(sub => sessions.some(sess => sess.username === sub.username)).length}
          </div>
          <div className={`text-[10px] mt-1 ${quickTab === 'connected' ? 'text-purple-200' : 'text-slate-400'}`}>جلسات نشطة لتدفق البيانات</div>
        </button>

        {/* منقطعين منذ أكثر من 29 يوم */}
        <button
          type="button"
          onClick={() => {
            setQuickTab('expired_29_plus');
            setStatusFilter('all');
          }}
          className={`p-4 col-span-2 md:col-span-1 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden select-none ${
            quickTab === 'expired_29_plus'
              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'bg-white border-slate-150 hover:border-slate-305 text-slate-800 shadow-xs hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10.5px] font-bold ${quickTab === 'expired_29_plus' ? 'text-rose-100' : 'text-slate-450'}`}>منقطعين (فوق +29 يوم)</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${quickTab === 'expired_29_plus' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700'}`}>
              LOST
            </span>
          </div>
          <div className="text-2xl font-black font-mono mt-2">
            {subscribers.filter(sub => {
              const expDate = new Date(sub.expiryDate);
              return (sub.status === 'expired') && (now.getTime() - expDate.getTime() > twentyNineDaysInMs);
            }).length}
          </div>
          <div className={`text-[10px] .truncate mt-1 ${quickTab === 'expired_29_plus' ? 'text-rose-200' : 'text-slate-400'}`}>تحفيز عودة العملاء المتأخرين</div>
        </button>

        {/* سينتهون خلال 3 أيام */}
        <button
          type="button"
          onClick={() => {
            setQuickTab('expiring_3_days');
            setStatusFilter('all');
          }}
          className={`p-4 col-span-2 md:col-span-1 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden select-none ${
            quickTab === 'expiring_3_days'
              ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-white border-slate-150 hover:border-slate-305 text-slate-800 shadow-xs hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10.5px] font-bold ${quickTab === 'expiring_3_days' ? 'text-slate-900 font-black' : 'text-slate-450'}`}>سينتهون خلال 3 أيام</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${quickTab === 'expiring_3_days' ? 'bg-black/10 text-slate-900 font-extrabold' : 'bg-amber-50 text-amber-700'}`}>
              WARN
            </span>
          </div>
          <div className="text-2xl font-black font-mono mt-2">
            {subscribers.filter(sub => {
              const expDate = new Date(sub.expiryDate);
              const timeLeft = expDate.getTime() - now.getTime();
              return (sub.status === 'active') && (timeLeft > 0) && (timeLeft <= threeDaysInMs);
            }).length}
          </div>
          <div className={`text-[10px] mt-1 ${quickTab === 'expiring_3_days' ? 'text-amber-950/70' : 'text-slate-400'}`}>تنبيه التجديد والاستكمال</div>
        </button>
      </div>

      {/* Filters & Search Block */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="ابحث باسم العميل، يوزر أو هاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-hidden focus:border-blue-500 focus:bg-white transition-all font-sans"
          />
        </div>

        {/* Profile plan filter */}
        <div>
          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-hidden focus:border-blue-500 focus:bg-white transition-all font-sans cursor-pointer"
          >
            <option value="all">كل باقات الاشتراكات</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-hidden focus:border-blue-500 focus:bg-white transition-all font-sans cursor-pointer"
          >
            <option value="all">كل الحالات النشطة/المتفوقة</option>
            <option value="active">نشط بالخدمة</option>
            <option value="expired">منتهي الصلاحية</option>
            <option value="disabled">محظور ومغلق</option>
          </select>
        </div>

        <div className="flex items-center justify-end text-xs text-slate-400 font-semibold pl-1">
          عدد النتائج: <span className="font-mono text-slate-800 mx-1">{filteredSubscribers.length}</span> مشتركين
        </div>
      </div>

      {/* Main Subscribers Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredSubscribers.length === 0 ? (
          <div className="p-16 text-center">
            <UserX className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-1" />
            <p className="text-sm font-semibold text-slate-500">لا يوجد أي مشترك مطابق للبحث الجاري</p>
            <p className="text-xs text-slate-400 mt-1">امسح الكلمات الدلالية أو ابدأ بتسجيل مشترك جديد بالشبكة.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[650px] relative" style={{ scrollbarGutter: 'stable' }}>
            <table className="w-full text-right text-sm min-w-[1300px] border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-sans text-xs border-b border-slate-200 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                <tr>
                  <th className="px-4 py-4 text-center w-10 bg-slate-50 sticky top-0 z-20">
                    <input 
                      type="checkbox"
                      className="rounded border-slate-300 cursor-pointer"
                      checked={selectedSubIds.length === filteredSubscribers.length && filteredSubscribers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSubIds(filteredSubscribers.map(s => s.id));
                        } else {
                          setSelectedSubIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">اسم العميل ومكتف الخدمة</th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">يوزر PPPoE والرمز</th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">السرعة والباقة المحددة</th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">السيرفر الرابط</th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">عنوان IP / MAC Lock</th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">انتهاء الصلاحية</th>
                  <th className="px-6 py-4 bg-slate-50 sticky top-0 z-20">الحالة</th>
                  <th className="px-6 py-4 text-center bg-slate-50 sticky top-0 z-20">إجراءات المايكروتك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {filteredSubscribers.map(sub => {
                  const isExpired = sub.status === 'expired';
                  const isDisabled = sub.status === 'disabled';
                  const isActive = sub.status === 'active';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-all">
                      {/* Checkbox selector */}
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox"
                          className="rounded border-slate-300 cursor-pointer"
                          checked={selectedSubIds.includes(sub.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubIds(prev => [...prev, sub.id]);
                            } else {
                              setSelectedSubIds(prev => prev.filter(id => id !== sub.id));
                            }
                          }}
                        />
                      </td>
                      {/* Name / phone */}
                      <td className="px-6 py-4">
                        <div className="font-sans font-bold text-slate-900">{sub.fullName}</div>
                        <div className="text-slate-500 font-mono mt-0.5 flex items-center gap-1 font-sans">
                          <Phone className="w-3 h-3 text-slate-400" /> {sub.phone || 'بدون رقم هاتف'}
                        </div>
                      </td>

                      {/* PPPoE user / pass */}
                      <td className="px-6 py-4 font-mono">
                        <div className="text-slate-800 font-bold">{sub.username}</div>
                        <div className="text-[10px] text-slate-500">P: {sub.password}</div>
                      </td>

                      {/* Speed profile */}
                      <td className="px-6 py-4 font-sans">
                        <div className="font-semibold text-slate-800 leading-tight">{getProfileName(sub.profileId)}</div>
                        <div className="text-[10px] text-blue-600 mt-0.5">
                          {formatPrice(profiles.find(p => p.id === sub.profileId)?.price || 0)}
                        </div>
                      </td>

                      {/* Router Server */}
                      <td className="px-6 py-4 text-slate-600 font-sans">
                        {getRouterName(sub.routerId)}
                      </td>

                      {/* IP / MAC Lock */}
                      <td className="px-6 py-4 font-mono">
                        <div className="text-slate-700 font-sans font-medium">{sub.ipAddress || 'توزيع تلقائي (Pool)'}</div>
                        {sub.macAddress ? (
                          <div className="mt-1.5 space-y-1 text-right">
                            <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100/60 rounded px-1.5 py-0.5 inline-flex items-center gap-1 font-sans font-bold leading-normal">
                              <Lock className="w-2.5 h-2.5 text-emerald-650 shrink-0" />
                              <span>مقفل MAC: {sub.macAddress}</span>
                            </div>
                            <div className="block">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMacModalSub(sub);
                                  setMacActionType('unlock');
                                  setMacInputValue('');
                                  setMacErrorMessage('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-550 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded text-[9.5px] font-bold font-sans cursor-pointer transition-all shrink-0 mt-0.5 leading-normal"
                                title="اضغط لفك قفل الماك للسماح لجهاز جديد بالصعود أونلاين"
                              >
                                <Unlock className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                <span>فك قفل الماك (السماح بجهاز جديد)</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1.5 space-y-1 text-right">
                            <div className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 inline-flex items-center gap-1 font-sans leading-normal">
                              <span>سماح بأي كابينة / جهاز (مفتوح)</span>
                            </div>
                            <div className="block">
                              {sessions.some(sess => sess.username === sub.username) ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const sess = sessions.find(s => s.username === sub.username);
                                    const currentMac = sess ? (sess.mac || sess.callerId || '') : '';
                                    setMacModalSub(sub);
                                    setMacActionType('lock');
                                    setMacInputValue(currentMac);
                                    setMacErrorMessage('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded text-[9.5px] font-bold font-sans cursor-pointer transition-all shrink-0 mt-0.5 leading-normal shadow-xs animate-pulse"
                                  title="المشترك متصل أونلاين حالياً. اضغط لقفل حسابه فوراً على الماك الذي سجل به الآن"
                                >
                                  <Lock className="w-2.5 h-2.5 text-white shrink-0" />
                                  <span>قفل الماك على جهازه الحالي المتصل أونلاين ✅</span>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMacModalSub(sub);
                                    setMacActionType('lock');
                                    setMacInputValue('');
                                    setMacErrorMessage('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-750 border border-blue-200 hover:border-blue-300 rounded text-[9.5px] font-bold font-sans cursor-pointer transition-all shrink-0 mt-0.5 leading-normal"
                                  title="اضغط لكتابة عنوان MAC يدوياً لقفل هذا العميل"
                                >
                                  <Lock className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                  <span>قفل MAC يدوي</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td className="px-6 py-4 font-mono">
                        <div className={`font-semibold ${
                          isExpired ? 'text-amber-600' : 'text-slate-700'
                        }`}>
                          {new Date(sub.expiryDate).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {Math.max(0, Math.round((new Date(sub.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24)))} يوم متبقي
                        </div>
                      </td>

                      {/* Status indicator */}
                      <td className="px-6 py-4 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          isExpired ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {isActive ? 'نشط بالخدمة' : isExpired ? 'منتهي الصلاحية' : 'موقف ومحظور'}
                        </span>
                      </td>

                      {/* Call Actions */}
                      <td className="px-6 py-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-2">
                          {/* Renew button */}
                          <button
                            onClick={() => handleOpenRenew(sub)}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-550 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-bold select-none cursor-pointer"
                          >
                            <TrendingUp className="w-3 h-3" /> تجديد
                          </button>

                          {/* Toggle active / disabled status */}
                          <button
                            onClick={() => toggleSubscriberStatus(sub.id)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isDisabled
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                            }`}
                            title={isDisabled ? 'تمكين الحساب يدوياً' : 'تعطيل الحظر يدوياً'}
                          >
                            {isDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          {/* Force Sync button */}
                          <button
                            onClick={() => {
                              syncSubscriberToRouter(sub.id, 'update', undefined, sub);
                            }}
                            className="p-1.5 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded-lg cursor-pointer transition-all"
                            title="إعادة مزامنة الحساب المباشرة مع مايكروتك"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin animate-duration-1000' : ''}`} />
                          </button>

                          {/* Manual WhatsApp Alert Button */}
                          <button
                            onClick={() => handleSendManualWhatsApp(sub)}
                            disabled={!sub.phone}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              sub.phone
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                : 'opacity-45 bg-slate-550/20 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                            title={sub.phone ? `إرسال تنبيه انتهاء الاشتراك عبر واتساب للمشترك يدوياً` : 'لا يوجد رقم هاتف مسجل لتنبيه الواتساب'}
                          >
                            <MessageSquare className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Modify Edit */}
                          <button
                            onClick={() => handleOpenEdit(sub)}
                            className="p-1.5 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-150 rounded-lg cursor-pointer transition-all"
                            title="تعديل البيانات"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت واثق من مسح المشترك ${sub.fullName} بالكامل؟ سيتم طرده وحذفه من مايكروتك.`)) {
                                deleteSubscriber(sub.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-lg cursor-pointer transition-all"
                            title="حذف الحساب نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Subscriber Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="font-bold text-base font-sans">تسجيل حساب PPPoE جديد</h3>
              <button 
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold select-none cursor-pointer"
              >✕</button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل الثلاثي <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="أدخل الاسم الصريح (مثال: حيدر كريم العراقي)"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-hidden focus:border-blue-500 focus:bg-white font-sans"
                />
              </div>

              {/* Username + Password PPPoE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم مستخدم PPPoE <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="User_Name"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full pl-3 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-hidden focus:border-blue-500 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={generateRandomUserAndPass}
                      className="absolute left-2 top-2 text-blue-600 hover:text-blue-800"
                      title="توليد عشوائي"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة مرور العميل <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف الجوال</label>
                <input
                  type="text"
                  placeholder="تلفون العميل للإنذار والمتابعة"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Router & Speed Package Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سيرفر المايكروتك</label>
                  <select
                    value={formData.routerId}
                    onChange={(e) => setFormData(prev => ({ ...prev, routerId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    {routers.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">باقة سرعة الاشتراك</label>
                  <select
                    value={formData.profileId}
                    onChange={(e) => setFormData(prev => ({ ...prev, profileId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Static IP and MAC lock limit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">آي بي ثابت (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: 10.0.20.100"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">قفل الـ MAC (Caller ID)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="AA:BB:CC:DD:EE:FF"
                      value={formData.macAddress}
                      onChange={(e) => setFormData(prev => ({ ...prev, macAddress: e.target.value }))}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={generateRandomMac}
                      className="absolute left-2 top-2 text-blue-605 text-xs font-bold hover:text-blue-800"
                      title="ماك عشوائي"
                    >
                      GEN
                    </button>
                  </div>
                </div>
              </div>

              {/* WhatsApp notification alerts selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نظام تنبيهات انتهاء الاشتراك (واتساب)</label>
                <select
                  value={formData.whatsappAlertMode}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappAlertMode: e.target.value as 'auto' | 'manual' }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer focus:border-blue-500 outline-hidden"
                >
                  <option value="auto">تلقائي (بوت آلي يرسل قبل انتهاء الاشتراك بـ 2 يوم)</option>
                  <option value="manual">يدوي فقط (يتم الضغط عليه من لوحة الإدارة يدوياً)</option>
                </select>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2 text-sm font-sans">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-250 cursor-pointer font-medium"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-semibold shadow-xs"
                >
                  تسجيل وتزامن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscriber Modal */}
      {editModalOpen && selectedSub && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base font-sans">تعديل بيانات العميل</h3>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل الثلاثي</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم يوزر الخدمة (ثابت لا يتغير)</label>
                  <input
                    type="text"
                    disabled
                    value={formData.username}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرمز السري الجديد</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">هاتف الاتصال</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المايكروتك المضيف</label>
                  <select
                    value={formData.routerId}
                    onChange={(e) => setFormData(prev => ({ ...prev, routerId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer"
                  >
                    {routers.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">باقة سرعة الاشتراك</label>
                  <select
                    value={formData.profileId}
                    onChange={(e) => setFormData(prev => ({ ...prev, profileId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer"
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">آي بي العميل</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">قفل الـ Caller ID MAC</label>
                  <input
                    type="text"
                    placeholder="AA:BB:CC..."
                    value={formData.macAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, macAddress: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* WhatsApp notification alerts selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نظام تنبيهات انتهاء الاشتراك (واتساب)</label>
                <select
                  value={formData.whatsappAlertMode}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappAlertMode: e.target.value as 'auto' | 'manual' }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer focus:border-blue-500 outline-hidden"
                >
                  <option value="auto">تلقائي (بوت آلي يرسل قبل انتهاء الاشتراك بـ 2 يوم)</option>
                  <option value="manual">يدوي فقط (يتم الضغط عليه من لوحة الإدارة يدوياً)</option>
                </select>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2 text-sm font-sans">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer font-bold"
                >
                  تعديل ومزامنة الحزمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Subscription Modal */}
      {renewModalOpen && selectedSub && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-100 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-emerald-950 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base font-sans">تجديد اشتراك العميل</h3>
                <p className="text-[11px] text-emerald-300 mt-0.5">العميل الحالي: {selectedSub.fullName}</p>
              </div>
              <button 
                onClick={() => setRenewModalOpen(false)}
                className="text-emerald-300 hover:text-white text-lg font-bold cursor-pointer"
              >✕</button>
            </div>

            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4">
              
              {/* Target service details */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">يوزر PPPoE:</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedSub.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">تاريخ الانتهاء الماثل:</span>
                  <span className="font-mono font-semibold text-slate-800">{new Date(selectedSub.expiryDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Package Plan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اختر باقة التجديد</label>
                <select
                  value={renewData.profileId}
                  onChange={(e) => setRenewData(prev => ({ ...prev, profileId: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm select-none cursor-pointer"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)})</option>
                  ))}
                </select>
              </div>

              {/* Duration Option Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">فترة تفعيل وتمديد الاشتراك</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setRenewData(prev => ({ ...prev, durationOption: 'default' }))}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                      renewData.durationOption === 'default'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs ring-1 ring-emerald-200'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>📅 كامل الباقة</span>
                    <span className="text-[9px] font-normal opacity-75">خطة تفعيل كاملة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewData(prev => ({ ...prev, durationOption: 'one_hour' }))}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                      renewData.durationOption === 'one_hour'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs ring-1 ring-amber-200 animate-pulse'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>⚡ ساعة واحدة</span>
                    <span className="text-[9px] font-normal opacity-75">فحص الخدمة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewData(prev => ({ ...prev, durationOption: 'two_hours' }))}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                      renewData.durationOption === 'two_hours'
                        ? 'bg-orange-50 border-orange-300 text-orange-800 shadow-xs ring-1 ring-orange-200'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>⚡ ساعتان 2</span>
                    <span className="text-[9px] font-normal opacity-75">اختبار متوسط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewData(prev => ({ ...prev, durationOption: 'four_hours' }))}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                      renewData.durationOption === 'four_hours'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs ring-1 ring-indigo-200'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span>⚡ 4 ساعات</span>
                    <span className="text-[9px] font-normal opacity-75">تجربة نصف يوم</span>
                  </button>
                </div>
              </div>

              {/* Payment Method Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع/الشحن بفيز أند كلين</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setRenewData(prev => ({ ...prev, paymentMethod: 'cash' }))}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      renewData.paymentMethod === 'cash'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    💰 تسديد نقدي (كاش)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewData(prev => ({ ...prev, paymentMethod: 'card' }))}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      renewData.paymentMethod === 'card'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    💳 كرت شحن (PIN)
                  </button>
                </div>
              </div>

              {/* Recharge Pin input block */}
              {renewData.paymentMethod === 'card' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رمز كرت الشحن (12 رقم المتسلسل)</label>
                  <input
                    type="text"
                    required
                    placeholder="981248214952"
                    value={renewData.cardPin}
                    onChange={(e) => setRenewData(prev => ({ ...prev, cardPin: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tracking-widest text-center"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    قم بتوليد الكروت من قسم "كروت الشحن" ونسخ رمز PIN الخاص بالباقة لتنفيذ الشحن.
                  </p>
                </div>
              )}

              {/* Display messages */}
              {renewError && (
                <div className="p-3 bg-rose-50 border border-rose-105 text-rose-700 text-xs rounded-lg font-bold">
                  ⚠️ {renewError}
                </div>
              )}

              {renewSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-lg font-bold">
                  ✅ {renewSuccess}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setRenewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer font-bold transition-all shadow-xs"
                >
                  تأكيد التفعيل الفوري
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🔐 CUSTOM MAC LOCK / UNLOCK INTERACTIVE MODAL */}
      {macActionType !== null && macModalSub && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-right animate-in zoom-in-95 duration-200" dir="rtl">
            <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
              {macActionType === 'unlock' && (
                <>
                  <Unlock className="w-5 h-5 text-rose-500" />
                  <span>تأكيد فك قفل الماك آدرس</span>
                </>
              )}
              {macActionType === 'lock' && (
                <>
                  <Lock className="w-5 h-5 text-blue-600" />
                  <span>قفل المشترك على ماك آدرس جديد</span>
                </>
              )}
              {macActionType === 'error' && (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>تنبيه خطأ التقاط الماك</span>
                </>
              )}
            </h3>

            <form onSubmit={handleMacModalSubmit} className="space-y-4">
              {macActionType === 'unlock' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-650 leading-relaxed font-sans">
                    هل أنت متأكد من فك قفل الماك (MAC Address) للعميل <strong className="text-slate-900 font-bold">{macModalSub.fullName || macModalSub.username}</strong>؟
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 font-sans leading-relaxed">
                    من خلال فك القفل، سيتمكن العميل من صعود الاتصال (Online) من أي جهاز جديد (سواء راوتر، ONU، أو هاتف) على الفور، وعندها سيقوم النظام بقفل حسابه على الماك الجديد إن اخترت ذلك لاحقاً.
                  </div>
                </div>
              )}

              {macActionType === 'lock' && (() => {
                const sess = sessions.find(s => s.username === macModalSub.username);
                const currentMac = sess ? (sess.mac || sess.callerId || '') : '';
                return (
                  <div className="space-y-3">
                    {currentMac ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-sans leading-relaxed">
                        <span className="font-bold block text-sm mb-1 text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>تم التقاط ماك المتصل تلقائياً!</span>
                        </span>
                        تمكن النظام من قراءة عنوان الماك الخاص بجهاز العميل المتصل أونلاين الآن وهو الموضح أدناه. يمكنك النقر على تأكيد القفل مباشرة أو تعديله إن أردت.
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-xs font-sans leading-relaxed">
                        <span className="font-bold block mb-1 text-amber-950 flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-amber-600" />
                          <span>العميل غير متصل حالياً</span>
                        </span>
                        لم يتم العثور على جهاز نشط للعميل لالتقاط الماك آدرس تلقائياً. يرجى كتابة عنوان الماك آدرس يدوياً في الحقل أدناه لقفل الاشتراك مسبقاً.
                      </div>
                    )}

                    <p className="text-sm text-slate-650 leading-relaxed font-sans">
                      أدخل أو راجع عنوان الماك لقفل اشتراك <strong className="text-slate-900 font-bold">{macModalSub.fullName || macModalSub.username}</strong> على جهازه الجديد:
                    </p>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الماك (MAC / Caller ID) <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="AA:BB:CC:DD:EE:FF"
                        value={macInputValue}
                        onChange={(e) => setMacInputValue(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] text-blue-800 font-sans leading-relaxed">
                      يساعد قفل الماك (Caller ID) في منع أي شخص آخر من سرقة يوزر الاشتراك وتشغيله على أجهزة مجهولة أو كبائن أخرى.
                    </div>
                  </div>
                );
              })()}

              {macActionType === 'error' && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-lg font-sans leading-relaxed">
                  {macErrorMessage}
                </div>
              )}

              {macErrorMessage && macActionType !== 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg font-sans font-bold">
                  ⚠️ {macErrorMessage}
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2 text-sm shrink-0">
                {macActionType === 'error' ? (
                  <button
                    type="button"
                    onClick={() => { setMacActionType(null); setMacModalSub(null); }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg cursor-pointer hover:bg-slate-800 transition-colors font-bold"
                  >
                    موافق، إغلاق الـتنبيه
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setMacActionType(null); setMacModalSub(null); }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                      إلغاء الإجراء
                    </button>
                    <button
                      type="submit"
                      className={`px-5 py-2 text-white rounded-lg cursor-pointer font-bold transition-all shadow-xs ${
                        macActionType === 'unlock' 
                          ? 'bg-rose-600 hover:bg-rose-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {macActionType === 'unlock' ? 'تأكيد فك قفل الماك آدرس' : 'قفل الحساب بالماك آدرس'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 SUCCESS CONFIRMATION MODAL AFTER RENEWAL */}
      {renewalSuccessData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden text-right animate-in zoom-in-95 duration-200">
            {/* Soft Green Sparkle Top Bar */}
            <div className="bg-emerald-600 text-white p-6 text-center flex flex-col items-center justify-center relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce duration-1000 mb-2">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-extrabold text-lg">تم تجديد الاشتراك بنجاح! 🎉</h3>
              <p className="text-xs text-emerald-100 mt-1">تمت مزامنة البيانات وتغذية السيرفر فورياً</p>
            </div>

            {/* Success Details Table */}
            <div className="p-6 space-y-4 font-sans text-sm">
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-500 font-bold">اسم المشترك:</span>
                  <span className="text-slate-900 font-extrabold text-base">{renewalSuccessData.subscriberName}</span>
                </div>
                
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-500">الباقة المفعلة:</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-black border border-emerald-100">
                    {renewalSuccessData.profileName}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-500 font-bold">فترة التفعيل/التمديد:</span>
                  <span className="text-slate-800 font-bold">{renewalSuccessData.duration}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-slate-500">طريقة تسوية الدفع:</span>
                  <span className="text-slate-800 font-bold">{renewalSuccessData.paymentMethod}</span>
                </div>

                <div className="flex flex-col gap-1 pt-1.5">
                  <span className="text-slate-500 text-xs font-bold">تاريخ انتهاء الاشتراك الجديد:</span>
                  <span className="text-emerald-700 font-mono font-black text-right text-sm">
                    {renewalSuccessData.expiryDate}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setRenewalSuccessData(null)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-98 cursor-pointer text-center text-sm"
              >
                حسناً، فهمت وإغلاق النافذة 👍
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP BULK NOTIFICATION WIZARD MODAL */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 scroll-smooth">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col text-right overflow-hidden animate-in zoom-in-95 duration-200" dir="rtl">
            
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-5 flex justify-between items-center shrink-0">
              <div className="space-y-1">
                <h3 className="text-base font-black font-sans flex items-center gap-2">
                  <span className="p-1 bg-emerald-500 text-slate-950 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-slate-950" />
                  </span>
                  معالج وتنبيهات انتهاء اشتراك المشتركين عبر WhatsApp جماعياً
                </h3>
                <p className="text-[11px] text-slate-450 font-sans">
                  إعداد وصياغة الرسائل وبث خطابات تذكير الدفع الفوري لـ {whatsappApiLogs.length} مشتركين تم تحديدهم جماعياً.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 font-bold font-sans text-xs cursor-pointer"
              >
                إغلاق المعالج ✕
              </button>
            </div>

            {/* Modal Body Container (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
              
              {/* Right Side Column (7 Cols on large): Draft and Settings */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Mode Selector Tabs */}
                <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex gap-1.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setWhatsappMethod('url_scheme')}
                    className={`flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      whatsappMethod === 'url_scheme'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    💬 طريقة الإرسال المجانية المباشرة
                  </button>
                  <button
                    type="button"
                    onClick={() => setWhatsappMethod('http_api')}
                    className={`flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      whatsappMethod === 'http_api'
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    ⚡ استخدام بوابة إلكترونية تلقائية (API)
                  </button>
                </div>

                {/* Main Settings Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  
                  {/* Explanation Block */}
                  {whatsappMethod === 'url_scheme' ? (
                    <div className="p-3 bg-emerald-50/60 border border-emerald-150 rounded-lg text-[11px] text-emerald-800 leading-relaxed font-sans">
                      <b>💡 الطريقة المباشرة (رابط المتصفح اليدوي):</b> نقوم بتوليد رسائل مخصصة بالكامل لكل مشترك وتأطيرها بتصميمك أدناه. يوفر لك هذا الأسلوب زر "فتح وإرسال" لكل عميل يوجهك مباشرة لـ WhatsApp Web بمجرد ضغطة واحدة، مجاني بالكامل ولا يتطلب سيرفرات مكلفة!
                    </div>
                  ) : (
                    <div className="p-3 bg-indigo-50/60 border border-indigo-150 rounded-lg text-[11px] text-indigo-800 leading-relaxed font-sans">
                      <b>💡 البوابة البرمجية التلقائية (Automation Gate):</b> تفويض نظام SuperSAS بالاتصال ببوابتك الخارجية (مثل UltraMsg، Twilio، أو Custom gateways) وتكليفه بإرسال الإشعارات دفعة واحدة في الخلفية بشكل متتابع وتوليد تقرير بالإرسال لحظة بلحظة.
                    </div>
                  )}

                  {/* Settings Tab Navigation (Template / Gateway) */}
                  <div className="border-b border-slate-100 pb-2 flex gap-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSettingsLoaded(true)} // reuse state internally or toggle local settings tab
                      className="text-slate-900 pb-1.5 border-b-2 border-slate-900"
                    >
                      صياغة رسالة تنبيه المشترك
                    </button>
                  </div>

                  {/* Template Composer Form */}
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-bold text-slate-700">قالب محتوى رسالة التنبيه</label>
                      <span className="text-[10px] text-slate-500 font-sans">يدعم الوسوم التفاعلية للمشتركين</span>
                    </div>

                    <textarea
                      rows={5}
                      value={whatsappTemplate}
                      onChange={(e) => setWhatsappTemplate(e.target.value)}
                      placeholder="اكتب رسالتك هنا..."
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-3 text-xs font-sans text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-hidden leading-relaxed resize-y"
                    />

                    {/* Interactive variables badges bar */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold text-slate-500">اضغط على أي تاق لإدراجه تلقائياً داخل القالب:</span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {[
                          { tag: '{fullName}', label: 'الاسم الكامل' },
                          { tag: '{username}', label: 'يوزر PPPoE' },
                          { tag: '{profileName}', label: 'باقة الاشتراك' },
                          { tag: '{expiryDate}', label: 'تاريخ الانتهاء' },
                          { tag: '{daysLeft}', label: 'الأيام المتبقية' },
                          { tag: '{price}', label: 'السعر المستحق' },
                          { tag: '{routerName}', label: 'اسم السيرفر' }
                        ].map(variable => (
                          <button
                            key={variable.tag}
                            type="button"
                            onClick={() => setWhatsappTemplate(prev => prev + variable.tag)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[10px] transition-all cursor-pointer font-bold border border-slate-150"
                          >
                            {variable.tag} ({variable.label})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Gateway Configuration Fields (only if http_api) */}
                  {whatsappMethod === 'http_api' && (
                    <div className="border-t border-slate-100 pt-4 space-y-4 animate-in slide-in-from-top-3 duration-150">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 font-sans">صياغة رابط بوابة الإرسال الخاصة بك (API Gateway URL)</h4>
                        <p className="text-[10px] text-slate-400">استخدم الوسوم لمناطق الرقم والمسج وسيتكفل المشغل باستبدالها آلياً لكل مشترك.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-755">رابط الـ GET API البرمجي للبوابة</label>
                        <input
                          type="text"
                          value={whatsappGatewayUrl}
                          onChange={(e) => setWhatsappGatewayUrl(e.target.value)}
                          placeholder="مثلاً: https://api.ultramsg.com/instance/messages/chat?token=XXX&to={phone}&body={message}"
                          className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2.5 font-mono text-xs text-left focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden"
                        />
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 leading-normal pt-1.5 font-sans">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded"><b>{"{phone}"}</b>: رقم هاتف المشترك مرمزاً</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded"><b>{"{message}"}</b>: نص الرسالة المولدة</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save configurations button */}
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        saveWhatsAppSettings(whatsappTemplate, whatsappMethod, whatsappGatewayUrl);
                        alert('تم حفظ إعدادات وقوالب ورابط تذكير واتساب في قاعدة SQLite بنجاح!');
                      }}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0"
                    >
                      حفظ إعدادات القوالب والـ API الآن
                    </button>
                  </div>

                </div>

                {/* Fast Preview Box */}
                {whatsappApiLogs.length > 0 && (
                  <div className="bg-amber-50/75 border border-amber-200 rounded-xl p-5 shadow-xs space-y-2">
                    <span className="block text-[10px] font-bold text-amber-800 font-sans">معاينة تمثيلية حية لكيف ستبدو الرسالة للعميل الأول:</span>
                    <p className="text-xs text-amber-900 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                      {generateWhatsAppMessage(whatsappApiLogs[0].subscriber, whatsappTemplate)}
                    </p>
                  </div>
                )}

              </div>

              {/* Left Side Column (5 Cols on large): Selected Subscribers list & sends monitoring */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden max-h-[100%] min-h-[400px]">
                
                {/* Header list controls */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                  <div className="space-y-0.5">
                    <span className="block text-xs font-black text-slate-850">قائمة المستلمين ({whatsappApiLogs.length})</span>
                    <span className="block text-[9px] text-slate-500">حالة الإرسال وحسابات التذكير</span>
                  </div>

                  {whatsappMethod === 'http_api' && (
                    <button
                      type="button"
                      onClick={runHttpWhatsappBulkSend}
                      disabled={whatsappSendingInProgress || whatsappApiLogs.length === 0}
                      className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-[11px] font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1"
                    >
                      {whatsappSendingInProgress ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          جاري البث...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          بث الإرسال للكل تلقائياً
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Filter and stats inside list card */}
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] flex gap-2 font-sans overflow-x-auto text-slate-500 shrink-0">
                  <span>بانتظار الإرسال: {whatsappApiLogs.filter(l => l.status === 'idle').length}</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold">مكتمل: {whatsappApiLogs.filter(l => l.status === 'success').length}</span>
                  <span>•</span>
                  <span className="text-rose-650 font-semibold">أخطاء وهواتف فارغة: {whatsappApiLogs.filter(l => l.status === 'error' || !l.phone).length}</span>
                </div>

                {/* Queue lists viewport */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {whatsappApiLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      لا يوجد أي مشتركين محددين حالياً لبث الإشعارات إليهم.
                    </div>
                  ) : (
                    whatsappApiLogs.map((item, index) => {
                      const textDraft = generateWhatsAppMessage(item.subscriber, whatsappTemplate);
                      
                      // Process Iraq phone to international format for standard URLs redirect
                      let cleanPhone = item.phone.replace(/[^0-9]/g, '');
                      if (cleanPhone.startsWith('07')) {
                        cleanPhone = '964' + cleanPhone.substring(1);
                      } else if (cleanPhone.startsWith('7')) {
                        cleanPhone = '964' + cleanPhone;
                      }

                      const directLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textDraft)}`;

                      return (
                        <div key={item.username || index} className="p-3.5 flex items-center justify-between gap-3 text-right group hover:bg-slate-50/50">
                          
                          {/* Left / Main info */}
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-sans font-bold text-slate-900 text-xs truncate max-w-[140px]" title={item.name}>
                                {item.name}
                              </span>
                              <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded truncate">
                                {item.username}
                              </span>
                            </div>
                            
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 leading-none font-sans">
                              <Phone className="w-2.5 h-2.5 text-slate-400" /> 
                              {item.phone ? item.phone : <span className="text-red-500 font-bold">بلا هاتف</span>}
                            </div>

                            {/* Show detailed sending logs for gateways */}
                            {item.message && (
                              <div className="text-[9px] text-slate-600 mt-0.5 leading-tight italic bg-slate-50 p-1.5 rounded font-sans border border-slate-100">
                                {item.message}
                              </div>
                            )}
                          </div>

                          {/* Right side operations and badges */}
                          <div className="text-left shrink-0">
                            {whatsappMethod === 'url_scheme' ? (
                              item.phone ? (
                                <a
                                  href={directLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => {
                                    setWhatsappApiLogs(prev => prev.map(log => log.username === item.username ? { ...log, status: 'success', message: 'رابط واتساب مفتوح' } : log));
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-black rounded-lg text-[10px] select-none transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
                                >
                                  فتح وإرسال 💬
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">بلا هاتف لتوليده</span>
                              )
                            ) : (
                              // Gateway Status Indicator Badges
                              <div>
                                {item.status === 'idle' && (
                                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-sans">
                                    بانتظار البث
                                  </span>
                                )}
                                {item.status === 'sending' && (
                                  <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-black animate-pulse font-sans flex items-center gap-0.5">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    جاري الإرسال
                                  </span>
                                )}
                                {item.status === 'success' && (
                                  <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-black font-sans flex items-center gap-0.5">
                                    ✓ مكتمل
                                  </span>
                                )}
                                {item.status === 'error' && (
                                  <span className="text-[10px] text-red-850 bg-red-50 px-2 py-0.5 rounded-full font-black font-sans flex items-center gap-0.5" title={item.message}>
                                    ✕ فشل
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer tutorial or notice */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between shrink-0 font-sans font-medium">
                  <span>المشتركون المحددون: {whatsappApiLogs.length}</span>
                  <span>SuperSAS v4 Alerts Gateway</span>
                </div>

              </div>

            </div>

            {/* Modal Bottom Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="px-5 py-2 bg-slate-900 border border-slate-200 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إنهاء وإغلاق المعالج التنبيهي
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
