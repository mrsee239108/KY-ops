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

  // Log Analyzer
  class LogAnalyzer{
    constructor(){
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
      this.levelStats = {info:0, warn:0, error:0};

      this.currentScanId = null;
      this.currentLogFile = '/var/log/syslog';

      $('#btnStartScan')?.addEventListener('click', ()=> this.startScan());
      $('#btnExportAnomalies')?.addEventListener('click', ()=> this.exportAnomalies());
      this.btnViewRepairs?.addEventListener('click', ()=> this.viewRepairActions());

      this.fetchTimer = null;
      this.startFetchLoop();
    }

    startFetchLoop(){
      this.fetchRealTimeLogs();
      this.fetchTimer = setInterval(()=> this.fetchRealTimeLogs(), 4000);
    }

    async fetchRealTimeLogs(){
      try{
        const res = await fetch(`/api/system-log`);
        if(!res.ok) throw new Error('获取实时日志失败');
        const data = await res.json();
        const raw = data.recent_logs[0];
        const logs = raw.split('\n');
        this.renderLogs(logs);
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
        const raw = data.recent_logs[0];
        const logs = raw.split('\n');
        this.renderLogs(logs);
      }catch(e){
        console.warn(e);
      }
    }

    renderLogs(logs){
      if(!this.listEl) return;
      
      // 清空现有日志
      this.listEl.innerHTML = '';
      
      logs.slice(-200).forEach(logEntry=>{
        const text = String(logEntry?.message || logEntry?.content || logEntry).trim();
        if(!text) return;
        
        const level = logEntry?.level || this.detectLogLevel(text);
        console.log(level, text);
        const timestamp = logEntry?.timestamp || new Date().toLocaleTimeString();

        this.levelStats[level] = (this.levelStats[level] || 0) + 1;
        
        const div = document.createElement('div');
        div.className = `log-entry ${level}`;
        div.innerHTML = `<span class="time">[${timestamp}]</span>${escapeHtml(text)}`;
        this.listEl.appendChild(div);
      });
      
      this.listEl.scrollTop = this.listEl.scrollHeight;
      this.updateLevelChart();
    }

    detectLogLevel(text){
      const lower = text.toLowerCase();
      if(/error|fail|traceback|exception|critical|fatal/.test(lower)) return 'error';
      if(/warn|warning|timeout|retry|deprecated/.test(lower)) return 'warn';
      return 'info';
    }

    updateLevelChart(){
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
        
        // 启动真实的日志扫描
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
      
      const checkProgress = async () => {
        try{
          const res = await fetch(`/api/security-scan/${this.currentScanId}`);
          if(!res.ok) throw new Error('获取扫描状态失败');
          
          const data = await res.json();
          const progress = data.progress || 0;
          const status = data.status;
          
          this.progressBar.style.width = `${progress}%`;
          this.progressText.textContent = `${progress}%`;
          
          let statusText = `状态：${status} | 已扫描：${data.lines_scanned || 0} 行 | 发现异常：${data.anomalies_found || 0}`;
          if(data.auto_repair_enabled){
            statusText += ` | 修复操作：${data.repair_actions_count || 0}`;
          }
          this.countInfo.innerHTML = statusText;
          
          if(status === 'completed'){
            // 显示查看修复按钮
            if(data.auto_repair_enabled && data.repair_actions_count > 0){
              this.btnViewRepairs.style.display = 'inline-block';
            }
            
            setTimeout(()=> {
              this.showProgress(false);
              this.loadAnomalies();
            }, 1000);
            notify('日志扫描完成','success');
            return;
          }
          
          if(status === 'failed'){
            this.showProgress(false);
            notify('日志扫描失败','danger');
            return;
          }
          
          // 继续监控
          setTimeout(checkProgress, 1000);
          
        }catch(e){
          console.error(e);
          this.showProgress(false);
          notify('监控扫描进度失败','danger');
        }
      };
      
      checkProgress();
    }

    async loadAnomalies(){
      if(!this.currentScanId || !this.anomalyEl) return;
      
      try{
        const res = await fetch(`/api/anomaly-list?scan_id=${this.currentScanId}`);
        if(!res.ok) throw new Error('获取异常列表失败');
        
        const data = await res.json();
        const anomalies = Array.isArray(data?.anomalies) ? data.anomalies : [];
        
        this.anomalyEl.innerHTML = '';
        
        anomalies.forEach(anomaly => {
          const item = document.createElement('div');
          item.className = `anomaly-item ${anomaly.severity || 'medium'}`;
          item.innerHTML = `
            <div class="title">${escapeHtml(anomaly.type || 'ANOMALY')} - ${escapeHtml(anomaly.message || anomaly.content || '')}</div>
            <div class="meta">时间：${anomaly.timestamp || ''} | 严重程度：${anomaly.severity || 'unknown'}</div>
          `;
          this.anomalyEl.appendChild(item);
        });
        
        if(anomalies.length === 0){
          this.anomalyEl.innerHTML = '<div class="no-data">未发现异常</div>';
        }
        
      }catch(e){
        console.error(e);
        notify('加载异常列表失败','danger');
      }
    }

    showProgress(show){
      if(!this.progressModal) return;
      this.progressModal.classList.toggle('show', !!show);
    }

    exportAnomalies(){
      const items = $$('.anomaly-item', this.anomalyEl).map(x=>x.textContent.trim());
      const blob = new Blob([items.join('\n')], {type:'text/plain;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `anomalies_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      notify('异常列表已导出','info');
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

  function main(){
    configureChartDefaults();
    initTabs();
    window.SecurityCenter = {
      logAnalyzer: new LogAnalyzer(),
      predictor: new Predictor(),
      scriptCenter: new ScriptCenter(),
      refreshPage, goBack
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', main);
  }else{ main(); }
})();