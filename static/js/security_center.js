'use strict';

(function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  // Chart.js defaults if available
  function configureChartDefaults(){
    if (!window.Chart) return;
    Chart.defaults.color = '#cbd5e1';
    Chart.defaults.borderColor = 'rgba(148,163,184,0.25)';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, \"Microsoft YaHei\", \"PingFang SC\", sans-serif';
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  }

  const API = {
    systemLog: '/api/system-log', // GET
    securityScan: '/api/security-scan', // POST (start scan) or GET (status)
    systemStatus: '/api/system-status', // GET
    performanceData: '/api/performance-data', // GET
    files: '/api/files', // GET list, POST save
    executeCommand: '/api/execute-command', // POST {cmd}
    securityOverview: '/api/security-overview', // GET
    todayLogsExport: '/api/today-logs-export', // GET
  };

  function notify(message, type='info', timeout=3500){
    let box = document.getElementById('alertNotification-container');
    if(!box){
      box = document.createElement('div');
      box.id = 'alertNotification-container';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `alert ${type}`;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateY(-4px)';
      setTimeout(()=> el.remove(), 250);
    }, timeout);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function initTabs(){
    const tabs = $$('.tab-btn');
    const views = $$('.tab-content');
    tabs.forEach(btn => {
      btn.addEventListener('click', ()=>{
        tabs.forEach(b=>b.classList.remove('active'));
        views.forEach(v=>v.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        const view = document.getElementById(target);
        if(view) view.classList.add('active');
      });
    });
  }

  // Utility
  function escapeHtml(str=''){
    return str.replace(/[&<>"']/g, s=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'
    })[s]||s);
  }

  // Security Overview
  class SecurityOverview{
    constructor(){
      this.todayLogsEl = $('#todayLogs');
      this.todayAnomaliesEl = $('#todayAnomalies');
      this.riskLevelEl = $('#riskLevel');
      this.monitorStatusEl = $('#monitorStatus');
      
      // 共享日志统计数据
      this.sharedLogStats = {
        totalLogs: 0,
        levelStats: {info: 0, warn: 0, error: 0}
      };
      
      this.startFetchLoop();
    }

    updateLogStats(logStats) {
        this.sharedLogStats = logStats;
        this.todayLogsEl.textContent = this.formatNumber(logStats.totalLogs);
        this.todayAnomaliesEl.textContent = this.formatNumber(logStats.levelStats.warn + logStats.levelStats.error);
    }

    startFetchLoop(){
      this.fetchOverviewData();
    }

    async fetchOverviewData(){
      try{
        const res = await fetch(API.securityOverview);
        if(!res.ok) throw new Error('获取安全概览数据失败');
        const data = await res.json();
        this.updateOverviewDisplay(data);
      }catch(e){
        console.warn('获取安全概览数据失败:', e);
        // 使用默认值
        this.updateOverviewDisplay({
          today_anomalies: '--',
          risk_level: '--',
          monitor_status: '运行中'
        });
      }
    }

    updateOverviewDisplay(data){
      // 今日日志数量现在由LogAnalyzer实时更新
      if(this.todayAnomaliesEl){
        let totalAnomalies = this.sharedLogStats.levelStats.warn +
                            this.sharedLogStats.levelStats.error;
        this.todayAnomaliesEl.textContent = this.formatNumber(totalAnomalies);
      }

      if(this.riskLevelEl){
        this.riskLevelEl.textContent = data.risk_level || '--';
        // 根据风险等级设置样式
        this.riskLevelEl.className = 'value ' + this.getRiskLevelClass(data.risk_level);
      }

      if(this.monitorStatusEl){
        this.monitorStatusEl.textContent = data.monitor_status || '运行中';
      }
    }

    formatNumber(num){
      if(num === null || num === undefined || num === '--') return '--';
      if(typeof num === 'number'){
        return num.toLocaleString();
      }
      return String(num);
    }

    getRiskLevelClass(level){
      switch(level){
        case '高危': return 'danger';
        case '中等': return 'warn';
        case '低风险': return 'info';
        case '正常': return 'info';
        default: return '';
      }
    }

    destroy(){
      if(this.fetchTimer){
        clearInterval(this.fetchTimer);
        this.fetchTimer = null;
      }
    }
  }

  // Log Analyzer
  class LogAnalyzer{
    constructor(securityOverview){
      this.listEl = $('#logStream');
      this.anomalyEl = $('#anomalyList');
      this.progressModal = $('#scanProgressModal');
      this.progressBar = $('#scanProgressBar');
      this.progressText = $('#scanProgressText');
      this.countInfo = $('#scanCountInfo');
      this.autoRepairToggle = $('#autoRepairToggle');
      this.btnViewRepairs = $('#btnViewRepairs');
      this.repairActionsModal = $('#repairActionsModal');
      this.repairActionsList = $('#repairActionsList');

      this.levelChart = null;
      this.levelChartEl = $('#logLevelChart');

      // 使用SecurityOverview的共享统计数据
      this.securityOverview = securityOverview;
      this.levelStats = {info:0, warn:0, error:0};
      this.totalLogs = 0; // 实时日志总数计数器

      this.currentScanId = null;
      this.currentLogFile = '/var/log/syslog';

      $('#btnStartScan')?.addEventListener('click', ()=> this.startScan());
      $('#btnExportAnomalies')?.addEventListener('click', ()=> this.exportAnomalies());
      this.btnViewRepairs?.addEventListener('click', ()=> this.viewRepairActions());

      this.fetchTimer = null;
      this.startFetchLoop();
      // 初始化时就加载异常列表
      this.loadAnomalies();
    }

    startFetchLoop(){
      this.fetchRealTimeLogs();
      this.fetchTimer = setInterval(()=> this.fetchRealTimeLogs(), 4000);
    }

    async fetchRealTimeLogs(){
      try{
        const res = await fetch(API.systemLog);
        if(!res.ok) throw new Error('获取实时日志失败');
        const data = await res.json();
        const allLogs = data.recent_logs.reduce((acc, logBlock) => {
          return acc.concat(logBlock.split('\n'));
        }, []);

        this.renderLogs(allLogs);
      }catch(e){
        console.warn(e);
        // 回退到原有API
        this.fetchOnce();
      }
    }

    async fetchOnce(){
      try{
        const res = await fetch(API.systemLog);
        if(!res.ok) throw new Error('获取系统日志失败');
        const data = await res.json();
        const allLogs = data.recent_logs.reduce((acc, logBlock) => {
          return acc.concat(logBlock.split('\n'));
        }, []);

        this.renderLogs(allLogs);
      }catch(e){
        console.warn(e);
      }
    }

    renderLogs(logs){
      if(!this.listEl) return;

      // 清空现有日志
      this.listEl.innerHTML = '';

      // 更新日志总数
      this.totalLogs = logs.length - 1;
      let levelLogsTemp = {info:0, warn:0, error:0};

      logs.forEach(logEntry=>{
        const text = String(logEntry?.message || logEntry?.content || logEntry).trim();
        if(!text) return;

        const level = logEntry?.level || this.detectLogLevel(text);
        const timestamp = logEntry?.timestamp || new Date().toLocaleTimeString();

        levelLogsTemp[level] = (levelLogsTemp[level] || 0) + 1;

        const div = document.createElement('div');
        div.className = `log-entry ${level}`;
        div.innerHTML = `<span class="time">[${timestamp}]</span>${escapeHtml(text)}`;
        this.listEl.appendChild(div);
      });

      this.levelStats['info'] = levelLogsTemp.info || 0;
      this.levelStats['warn'] = levelLogsTemp.warn || 0;
      this.levelStats['error'] = levelLogsTemp.error || 0;

      this.listEl.scrollTop = this.listEl.scrollHeight;

      // 更新概览和图表
      this.securityOverview.updateLogStats({
        totalLogs: this.totalLogs,
        levelStats: this.levelStats
      });
      this.updateLevelChart();
    }

    detectLogLevel(text){
      const lower = text.toLowerCase();
      if(/error|fail|traceback|exception|critical|fatal/.test(lower)) return 'error';
      if(/warn|warning|timeout|retry|deprecated/.test(lower)) return 'warn';
      return 'info';
    }

    async updateLevelChart() {
      if(!this.levelChartEl || !window.Chart) return;
      if(!this.levelChart){
        this.levelChart = new Chart(this.levelChartEl.getContext('2d'),{
          type:'doughnut',
          data:{
            labels:['INFO','WARN','ERROR'],
            datasets:[{data:[0,0,0], backgroundColor:['#9dbcfb','#fde68a','#fecaca'], borderWidth:0}]
          },
          options:{plugins:{legend:{position:'bottom'}}, cutout:'65%'}
        });
      }

      // 直接使用本地统计数据
      const ds = this.levelChart.data.datasets[0];
      ds.data = [this.levelStats.info || 0, this.levelStats.warn || 0, this.levelStats.error || 0];
      this.levelChart.update();
    }

    async startScan(){
      try{
        this.showProgress(true);
        this.progressBar.style.width = '0%';
        this.progressText.textContent = '0%';
        this.countInfo.innerHTML = '正在启动扫描...';
        
        // 日志扫描
        const enableAutoRepair = this.autoRepairToggle?.checked || false;
        const scanRes = await fetch('/api/security-scan', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            scan_type: 'log_analysis',
            max_lines: 10000,
            log_files: ['/var/log/syslog', '/var/log/messages', '/var/log/kern.log'],
            enable_auto_repair: enableAutoRepair
          })
        });
        
        if(!scanRes.ok) throw new Error('启动扫描失败');
        const scanData = await scanRes.json();
        this.currentScanId = scanData.scan_id;
        
        // 监控扫描进度
        this.monitorScanProgress();
        
      }catch(e){
        console.error(e);
        notify('启动扫描失败: ' + e.message,'danger');
        this.showProgress(false);
      }
    }

    async monitorScanProgress(){
      if(!this.currentScanId) return;
      
      let retryCount = 0;
      const maxRetries = 3;
      
      const checkProgress = async () => {
        try{
          const res = await fetch(`/api/security-scan/${this.currentScanId}`);
          
          // 处理HTTP错误状态
          if(!res.ok) {
            if(res.status === 404) {
              throw new Error('扫描任务不存在');
            } else {
              throw new Error(`HTTP ${res.status}: 获取扫描状态失败`);
            }
          }
          
          const data = await res.json();
          
          // 检查返回的数据是否有错误
          if(data.error) {
            throw new Error(data.error);
          }
          
          const progress = Math.min(100, Math.max(0, data.progress || 0));
          const status = data.status || 'unknown';
          
          // 更新进度条
          this.progressBar.style.width = `${progress}%`;
          this.progressText.textContent = `${progress}%`;
          
          // 更新状态信息
          let statusText = `状态：${status} | 已扫描：${data.lines_scanned || data.files_scanned || 0} 项 | 发现威胁：${data.anomalies_found || data.threats_found || 0}`;
          if(data.auto_repair_enabled){
            statusText += ` | 修复操作：${data.repair_actions_count || 0}`;
          }
          this.countInfo.innerHTML = statusText;
          
          // 处理完成状态
          if(status === 'completed' || progress >= 100){
            // 显示查看修复按钮
            if(data.auto_repair_enabled && data.repair_actions_count > 0){
              this.btnViewRepairs.style.display = 'inline-block';
            }
            
            setTimeout(()=> {
              this.showProgress(false);
              this.loadAnomalies();
            }, 1000);
            notify('安全扫描完成','success');
            return;
          }
          
          // 处理失败状态
          if(status === 'failed' || status === 'not_found'){
            this.showProgress(false);
            notify(`安全扫描失败: ${data.error || '未知错误'}`, 'danger');
            return;
          }
          
          // 重置重试计数器（成功获取状态）
          retryCount = 0;
          
          // 继续监控
          setTimeout(checkProgress, 1000);
          
        }catch(e){
          console.error('监控扫描进度错误:', e);
          retryCount++;
          
          if(retryCount >= maxRetries) {
            this.showProgress(false);
            notify(`监控扫描进度失败: ${e.message}`, 'danger');
            return;
          }
          
          // 重试前等待更长时间
          setTimeout(checkProgress, 2000 * retryCount);
        }
      };
      
      checkProgress();
    }

    async loadAnomalies(){
      if(!this.anomalyEl) return;
      
      try{
        // 如果有当前扫描ID，优先获取该扫描的异常
        let url = '/api/anomaly-list';
        if(this.currentScanId) {
          url += `?scan_id=${this.currentScanId}`;
        }
        
        const res = await fetch(url);
        if(!res.ok) throw new Error('获取异常列表失败');
        
        const data = await res.json();
        const anomalies = Array.isArray(data?.anomalies) ? data.anomalies : [];
        
        console.log('加载异常列表:', anomalies.length, '个异常');
        this.renderAnomalies(anomalies);
        
      }catch(e){
        console.error('加载异常列表失败:', e);
        // 显示错误信息但不弹出通知，避免过于频繁
        if(this.anomalyEl) {
          this.anomalyEl.innerHTML = '<div class="error-message">加载异常列表失败，请稍后重试</div>';
        }
      }
    }

    renderAnomalies(anomalies){
      if(!this.anomalyEl) return;
      
      this.anomalyEl.innerHTML = '';
      
      anomalies.forEach(anomaly => {
        const item = document.createElement('div');
        item.className = `anomaly-item ${anomaly.severity || 'medium'}`;
        
        // 根据异常类型显示不同的图标和样式
        const typeIcon = this.getAnomalyIcon(anomaly.type);
        const severityClass = this.getSeverityClass(anomaly.severity);
        
        // 生成建议脚本
        const suggestedScript = this.generateSuggestedScript(anomaly);
        
        item.innerHTML = `
          <div class="anomaly-header">
            <span class="anomaly-icon ${severityClass}">${typeIcon}</span>
            <span class="anomaly-type">${escapeHtml(anomaly.type || 'ANOMALY')}</span>
            <span class="anomaly-severity ${severityClass}">${escapeHtml(anomaly.severity || 'unknown')}</span>
          </div>
          <div class="anomaly-message">${escapeHtml(anomaly.message || anomaly.content || '')}</div>
          <div class="anomaly-meta">
            <span class="timestamp">时间：${anomaly.timestamp || ''}</span>
            ${anomaly.source ? `<span class="source">来源：${escapeHtml(anomaly.source)}</span>` : ''}
            ${anomaly.count ? `<span class="count">出现次数：${anomaly.count}</span>` : ''}
          </div>
          ${anomaly.suggestion ? `<div class="anomaly-suggestion">建议：${escapeHtml(anomaly.suggestion)}</div>` : ''}
          <div class="suggested-script">
            <div class="script-header">
              <span><i class="fas fa-code"></i> 建议脚本</span>
            </div>
            <div class="script-content">
              <textarea class="script-code" readonly>${suggestedScript}</textarea>
            </div>
            <div class="script-actions">
                <button class="script-btn copy-btn" 
                        onclick="window.SecurityCenter.logAnalyzer.copyScript(\`${suggestedScript.replace(/`/g, '\\`')}\`)">
                  <i class="fas fa-copy"></i> 复制脚本
                </button>
                <button class="script-btn ai-btn" 
                        onclick="window.SecurityCenter.logAnalyzer.askAI(${JSON.stringify(anomaly).replace(/"/g, '&quot;')})">
                  <i class="fas fa-robot"></i> AI询问
                </button>
            </div>
          </div>
        `;
        
        this.anomalyEl.appendChild(item);
      });
      
      if(anomalies.length === 0){
        this.anomalyEl.innerHTML = '<div class="no-data">未发现异常</div>';
      }
    }

    getAnomalyIcon(type){
      const iconMap = {
        'FAILED_LOGIN': '🔐',
        'SUSPICIOUS_ACTIVITY': '⚠️',
        'SYSTEM_ERROR': '❌',
        'PERFORMANCE_ISSUE': '📊',
        'SECURITY_THREAT': '🛡️',
        'NETWORK_ANOMALY': '🌐',
        'FILE_ACCESS': '📁',
        'PRIVILEGE_ESCALATION': '⬆️',
        'MALWARE_DETECTED': '🦠',
        'BRUTE_FORCE': '🔨'
      };
      return iconMap[type] || '⚠️';
    }

    getSeverityClass(severity){
      switch(severity?.toLowerCase()){
        case 'critical': case 'high': return 'severity-high';
        case 'medium': case 'moderate': return 'severity-medium';
        case 'low': case 'info': return 'severity-low';
        default: return 'severity-unknown';
      }
    }

    showProgress(show){
      if(!this.progressModal) return;
      this.progressModal.classList.toggle('show', !!show);
    }

    async exportAnomalies(){
      try{
        notify('正在获取今日日志数据...', 'info');
        
        // 获取今日日志数据
        const res = await fetch(API.todayLogsExport);
        if(!res.ok) throw new Error('获取日志数据失败');
        
        const data = await res.json();
        const logs = data.logs || [];
        
        if(logs.length === 0){
          notify('没有找到今日日志数据', 'warning');
          return;
        }
        
        // 生成CSV内容
        const csvContent = this.generateCSV(logs, data.export_time);
        
        // 创建并下载CSV文件
        const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8-sig'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        const today = new Date().toISOString().split('T')[0];
        a.download = `今日处理日志_${today}.csv`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        
        notify(`成功导出 ${logs.length} 条日志记录`, 'success');
        
      }catch(e){
        console.error('导出日志失败:', e);
        notify('导出日志失败: ' + e.message, 'danger');
      }
    }

    generateCSV(logs, exportTime){
      // CSV头部
      const headers = ['时间戳', '日志级别', '来源', '消息内容'];
      let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
      
      // 添加导出信息
      csvContent += `# 今日处理日志导出报告\n`;
      csvContent += `# 导出时间: ${exportTime}\n`;
      csvContent += `# 记录总数: ${logs.length}\n`;
      csvContent += `# 系统: KY-ops 智能运维管家\n`;
      csvContent += `\n`;
      
      // 添加CSV头部
      csvContent += headers.join(',') + '\n';
      
      // 添加数据行
      logs.forEach(log => {
        const row = [
          this.escapeCsvField(log.timestamp || ''),
          this.escapeCsvField(log.level || ''),
          this.escapeCsvField(log.source || ''),
          this.escapeCsvField(log.message || '')
        ];
        csvContent += row.join(',') + '\n';
      });
      
      return csvContent;
    }

    escapeCsvField(field){
      // 处理CSV字段转义
      if(field === null || field === undefined) return '';
      
      const str = String(field);
      
      // 如果包含逗号、引号或换行符，需要用引号包围并转义内部引号
      if(str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')){
        return '"' + str.replace(/"/g, '""') + '"';
      }
      
      return str;
    }

    async viewRepairActions(){
       if(!this.repairActionsModal || !this.repairActionsList || !this.currentScanId) return;
       
       try{
         const res = await fetch(`/api/repair-actions?scan_id=${this.currentScanId}`);
         if(!res.ok) throw new Error('获取修复记录失败');
         
         const data = await res.json();
         const actions = Array.isArray(data?.repair_actions) ? data.repair_actions : [];
        
        this.repairActionsList.innerHTML = '';
        
        actions.forEach(action => {
          const item = document.createElement('div');
          item.className = `repair-action-item ${action.status || 'pending'}`;
          item.innerHTML = `
            <div class="action-header">
              <span class="action-type">${escapeHtml(action.type || 'REPAIR')}</span>
              <span class="action-status ${action.status}">${escapeHtml(action.status || 'pending')}</span>
            </div>
            <div class="action-description">${escapeHtml(action.description || '')}</div>
            <div class="action-meta">
              <span>时间：${action.timestamp || ''}</span>
              <span>目标：${escapeHtml(action.target || '')}</span>
            </div>
            ${action.result ? `<div class="action-result">${escapeHtml(action.result)}</div>` : ''}
          `;
          this.repairActionsList.appendChild(item);
        });
        
        if(actions.length === 0){
          this.repairActionsList.innerHTML = '<div class="no-data">暂无修复记录</div>';
        }
        
        this.repairActionsModal.classList.add('show');
        
      }catch(e){
        console.error(e);
        notify('获取修复记录失败','danger');
      }
    }

    // 生成建议脚本
    generateSuggestedScript(anomaly) {
      const type = anomaly.type || 'UNKNOWN';
      const message = anomaly.message || anomaly.content || '';
      
      // 根据异常类型生成相应的脚本
      switch(type) {
        case 'FAILED_LOGIN':
          return `# 检查失败登录记录
# Windows
Get-EventLog -LogName Security -InstanceId 4625 | Select-Object -First 10

# Linux
sudo grep "Failed password" /var/log/auth.log | tail -10

# 锁定可疑IP
# iptables -A INPUT -s <suspicious_ip> -j DROP`;

        case 'SYSTEM_ERROR':
          return `# 系统错误诊断
# 检查系统日志
# Windows
Get-EventLog -LogName System -EntryType Error | Select-Object -First 10

# Linux
sudo journalctl -p err -n 10

# 检查磁盘空间
df -h

# 检查内存使用
free -h`;

        case 'PERFORMANCE_ISSUE':
          return `# 性能问题诊断
# 检查CPU使用率
top -n 1

# 检查内存使用
free -h

# 检查磁盘IO
iostat -x 1 5

# 检查网络连接
netstat -tuln`;

        case 'SECURITY_THREAT':
          return `# 安全威胁处理
# 扫描恶意进程
ps aux | grep -E "(malware|virus|trojan)"

# 检查网络连接
netstat -tuln | grep ESTABLISHED

# 更新系统
# Ubuntu/Debian
sudo apt update && sudo apt upgrade

# CentOS/RHEL
sudo yum update`;

        case 'NETWORK_ANOMALY':
          return `# 网络异常诊断
# 检查网络接口
ip addr show

# 检查路由表
ip route show

# 测试网络连通性
ping -c 4 8.8.8.8

# 检查DNS解析
nslookup google.com`;

        case 'FILE_ACCESS':
          return `# 文件访问异常检查
# 检查文件权限
ls -la /path/to/file

# 检查文件访问日志
# Linux
sudo ausearch -f /path/to/file

# 检查进程文件句柄
lsof | grep /path/to/file`;

        default:
          return `# 通用系统诊断脚本
# 检查系统状态
uptime

# 检查磁盘使用
df -h

# 检查内存使用
free -h

# 检查进程
ps aux | head -10

# 检查网络
netstat -tuln | head -10

# 检查日志
tail -n 20 /var/log/syslog`;
      }
    }

    // 复制脚本到剪贴板
    copyScript(script) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(script).then(() => {
          notify('脚本已复制到剪贴板', 'success');
        }).catch(err => {
          console.error('复制失败:', err);
          this.fallbackCopyScript(script);
        });
      } else {
        this.fallbackCopyScript(script);
      }
    }

    // 备用复制方法
    fallbackCopyScript(script) {
      const textArea = document.createElement('textarea');
      textArea.value = script;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        notify('脚本已复制到剪贴板', 'success');
      } catch (err) {
        console.error('复制失败:', err);
        notify('复制失败，请手动复制', 'danger');
      }
      
      document.body.removeChild(textArea);
    }

    // 跳转到AI助手并预填充错误日志
    askAI(anomalyData) {
      try {
        // 解析异常数据
        const anomaly = typeof anomalyData === 'string' ? JSON.parse(anomalyData) : anomalyData;
        
        // 构建AI询问的提示词
        const prompt = `请帮我分析以下系统异常并提供解决方案：

异常类型：${anomaly.type || 'UNKNOWN'}
严重程度：${anomaly.severity || 'unknown'}
异常消息：${anomaly.message || anomaly.content || ''}
发生时间：${anomaly.timestamp || ''}
${anomaly.source ? `来源：${anomaly.source}` : ''}
${anomaly.count ? `出现次数：${anomaly.count}` : ''}

请提供：
1. 问题的可能原因分析
2. 详细的解决步骤
3. 预防措施建议
4. 相关的诊断命令或脚本

谢谢！`;

        // 将提示词存储到sessionStorage，以便AI助手页面读取
        sessionStorage.setItem('ai_prefill_prompt', prompt);
        
        // 跳转到AI助手页面
        window.open('/ai-chat#askAI', '_blank');
        
        notify('正在跳转到AI助手...', 'info');
        
      } catch (error) {
        console.error('跳转AI助手失败:', error);
        notify('跳转AI助手失败', 'danger');
      }
    }
  }

  // Predictor
  class Predictor{
    constructor(){
      this.cpuChart = null; this.memChart = null; this.diskChart=null; this.netChart=null; this.riskChart=null;
      this.initCharts();
      this.loop();
    }

    initCharts(){
      const cpuEl=$('#cpuChart'), memEl=$('#memChart'), diskEl=$('#diskChart'), netEl=$('#netChart'), riskEl=$('#riskTrend');
      if(window.Chart){
        this.cpuChart = new Chart(cpuEl, {type:'line', data:this.series('CPU %'), options:this.lineOpts()});
        this.memChart = new Chart(memEl, {type:'line', data:this.series('Memory %','#22c55e'), options:this.lineOpts()});
        this.diskChart= new Chart(diskEl,{type:'line', data:this.series('Disk %','#f59e0b'), options:this.lineOpts()});
        this.netChart = new Chart(netEl, {type:'line', data:this.series('Net I/O','#a78bfa'), options:this.lineOpts()});
        this.riskChart= new Chart(riskEl,{type:'bar', data:{labels:[], datasets:[{label:'风险值', data:[], backgroundColor:'#ef4444aa'}]}, options:{responsive:true,maintainAspectRatio:false, scales:{y:{min:0,max:100}}}});
      }
    }

    series(label,color='#3b82f6'){
      return {labels:[], datasets:[{label, data:[], tension:.25, borderColor:color, backgroundColor: color+'33', fill:true, pointRadius:0}]};
    }
    lineOpts(){
      return {responsive:true, maintainAspectRatio:false, scales:{y:{min:0,max:100}}};
    }

    loop(){
      this.fetchOnce();
      this.timer = setInterval(()=> this.fetchOnce(), 3000);
    }

    async fetchOnce(){
      let data=null;
      try{
        const res = await fetch(API.performanceData);
        if(res.ok) data = await res.json();
      }catch{}
      if(!data){
        try{
          const res = await fetch(API.systemStatus);
          if(res.ok) data = await res.json();
        }catch{}
      }
      if(!data) return;
      this.consume(data);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }


    consume(data){
      const now = new Date().toLocaleTimeString();
      const cpu = Math.round((data.cpu_percent ?? data.cpu?.total ?? 0));
      const mem = Math.round((data.memory_percent ?? data.memory?.percent ?? 0));
      const disk = Math.round(data.total_utilization);
      const netIn = Number(data.rx_speed ?? 0);
      const netOut = Number(data.tx_speed ?? 0);
      const net = Math.min(100, Math.round(((netIn+netOut)%1e7)/1e5));

      this.pushPoint(this.cpuChart, now, cpu);
      this.pushPoint(this.memChart, now, mem);
      this.pushPoint(this.diskChart,now, disk);
      this.pushPoint(this.netChart, now, net);

      this.updateElement('cpuVal', `${cpu}%`);
      this.updateElement('memVal', `${mem}%`);
      this.updateElement('diskVal', `${disk}%`);
      this.updateElement('netVal', `↓${formatBytes(netIn)} / ↑${formatBytes(netOut)}`);

      const risk = Math.min(100, Math.round(cpu*0.4 + mem*0.25 + disk*0.2 + net*0.15));
      if(this.riskChart){
        const l = this.riskChart.data.labels; const d = this.riskChart.data.datasets[0].data;
        l.push(now); d.push(risk);
        if(l.length>20){l.shift(); d.shift();}
        this.riskChart.update();
      }

      // thresholds alerts
      if(cpu>=85) notify(`CPU 使用率较高：${cpu}%`,'warning');
      if(mem>=90) notify(`内存使用率较高：${mem}%`,'warning');
      if(disk>=90) notify(`磁盘使用率较高：${disk}%`,'warning');
    }

    pushPoint(chart, label, value){
      if(!chart) return;
      const labels = chart.data.labels;
      const data = chart.data.datasets[0].data;
      labels.push(label); data.push(value);
      if(labels.length>30){ labels.shift(); data.shift(); }
      chart.update();
    }
  }

  // Script Center
  class ScriptCenter{
    constructor(){
      this.modal = $('#scriptEditorModal');
      this.titleEl = $('#scriptEditorTitle');
      this.nameEl = $('#scriptName');
      this.typeEl = $('#scriptType');
      this.descEl = $('#scriptDesc');
      this.codeEl = $('#scriptCode');
      this.execLogs = $('#executionLogs');

      this.current = null; // {name, type, desc, content}

      $('#btnNewScript')?.addEventListener('click', ()=> this.openEditor());
      $('#btnSaveScript')?.addEventListener('click', ()=> this.saveScript());
      $('#btnCloseEditor')?.addEventListener('click', ()=> this.showEditor(false));

      this.listEl = $('#scriptList');
      this.loadList();
    }

    async loadList(){
      try{
        const res = await fetch(API.files);
        const data = await res.json().catch(()=>[]);
        const files = Array.isArray(data?.files) ? data.files : (Array.isArray(data)?data:[]);
        this.renderList(files);
      }catch(e){ console.warn(e); }
    }

    renderList(files){
      if(!this.listEl) return;
      this.listEl.innerHTML = '';
      files.filter(f=>/\.(sh|ps1|bat|py|js)$/i.test(f.name||f)).slice(0,100).forEach(item=>{
        const name = item.name || item;
        const meta = item.size ? `${(item.size/1024).toFixed(1)} KB` : '';
        const el = document.createElement('div');
        el.className = 'script-item';
        el.innerHTML = `
          <div>
            <div class="title">${escapeHtml(name)}</div>
            <div class="meta">${escapeHtml(meta)}</div>
          </div>
          <div class="script-actions">
            <button class="btn btn-sm" data-act="edit">编辑</button>
            <button class="btn btn-sm primary" data-act="run">运行</button>
            <button class="btn btn-sm" data-act="download">下载</button>
          </div>`;
        el.addEventListener('click', (ev)=>{
          const act = ev.target?.dataset?.act;
          if(act==='edit') this.openEditor({name});
          if(act==='run') this.runScript(name);
          if(act==='download') this.download(name);
        });
        this.listEl.appendChild(el);
      });
    }

    openEditor(script=null){
      this.current = script;
      this.titleEl.textContent = script? `编辑脚本 - ${script.name}` : '新建脚本';
      this.nameEl.value = script?.name || '';
      this.typeEl.value = this.detectType(script?.name || '');
      this.descEl.value = '';
      this.codeEl.value = '';
      this.showEditor(true);
    }

    detectType(name){
      if(/\.ps1$/i.test(name)) return 'ps1';
      if(/\.bat$/i.test(name)) return 'bat';
      if(/\.py$/i.test(name)) return 'py';
      if(/\.js$/i.test(name)) return 'js';
      return 'sh';
    }

    showEditor(show){ this.modal?.classList.toggle('show', !!show); }

    async saveScript(){
      try{
        const body = {
          name: this.nameEl.value.trim(),
          type: this.typeEl.value,
          desc: this.descEl.value.trim(),
          content: this.codeEl.value
        };
        if(!body.name){ notify('脚本名称不能为空','danger'); return; }
        const res = await fetch(API.files, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
        if(!res.ok) throw new Error('保存失败');
        notify('脚本已保存','success');
        this.showEditor(false);
        this.loadList();
      }catch(e){
        console.error(e);
        notify('保存脚本失败','danger');
      }
    }

    async runScript(name){
      try{
        const cmd = this.composeRunCommand(name);
        const res = await fetch(API.executeCommand, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({cmd})});
        const data = await res.json().catch(()=>({}));
        const out = data.output || data.stdout || JSON.stringify(data);
        this.appendLog(`$ ${cmd}\n${out}`);
        notify('脚本执行完成','success');
      }catch(e){
        console.error(e);
        this.appendLog(`执行失败: ${e.message}`);
        notify('脚本执行失败','danger');
      }
    }

    composeRunCommand(name){
      if(/\.ps1$/i.test(name)) return `powershell -ExecutionPolicy Bypass -File \"${name}\"`;
      if(/\.bat$/i.test(name)) return `cmd /c \"${name}\"`;
      if(/\.py$/i.test(name)) return `python \"${name}\"`;
      if(/\.js$/i.test(name)) return `node \"${name}\"`;
      return `bash \"${name}\"`;
    }

    download(name){
      const a = document.createElement('a');
      a.href = `${API.files}?name=${encodeURIComponent(name)}`;
      a.download = name;
      a.click();
    }

    appendLog(text){
      if(!this.execLogs) return;
      const el = document.createElement('div');
      el.className = 'exec-entry';
      el.textContent = text;
      this.execLogs.appendChild(el);
      this.execLogs.scrollTop = this.execLogs.scrollHeight;
    }
  }

  function refreshPage(){ location.reload(); }
  function goBack(){ history.back(); }

  // 主题切换功能
function toggleTheme() {
    if (window.themeManager) {
        window.themeManager.toggleTheme();
        updateThemeIcon();
    } else {
        // 如果主题管理器还没有初始化，等待一下再尝试
        setTimeout(() => {
            if (window.themeManager) {
                window.themeManager.toggleTheme();
                updateThemeIcon();
            }
        }, 100);
    }
}

function updateThemeIcon() {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon && window.themeManager) {
        const isDark = window.themeManager.getCurrentTheme() === 'dark';
        themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// 监听主题变化事件
window.addEventListener('themeChanged', function(e) {
    updateThemeIcon();
});

// 页面加载完成后初始化主题图标
document.addEventListener('DOMContentLoaded', function() {
    // 延迟一下确保主题管理器已经初始化
    setTimeout(() => {
        updateThemeIcon();
    }, 50);
});

  // 将函数暴露到全局作用域
  window.refreshPage = refreshPage;
  window.goBack = goBack;
  window.toggleTheme = toggleTheme;

  function main() {
    configureChartDefaults();
    initTabs();

    // 提前创建全局对象
    window.SecurityCenter = {
      securityOverview: new SecurityOverview(),
      refreshPage,
      goBack
    };

    // 初始化其他组件
    window.SecurityCenter.logAnalyzer = new LogAnalyzer(window.SecurityCenter.securityOverview);
    window.SecurityCenter.predictor = new Predictor();
    window.SecurityCenter.scriptCenter = new ScriptCenter();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', main);
  }else{ main(); }
})();