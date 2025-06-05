class GPUMonitor {
    constructor() {
        this.prometheusUrl = 'http://localhost:9090';
        this.refreshInterval = 30000; // 30秒
        this.autoRefreshTimer = null;
        this.init();
    }

    init() {
        this.loadData();
        this.startAutoRefresh();
    }

    async loadData() {
        try {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('error').style.display = 'none';
            document.getElementById('dashboard').style.display = 'none';

            const [nodeData, podData, hardwareData] = await Promise.all([
                this.fetchNodeMetrics(),
                this.fetchPodMetrics(),
                this.fetchHardwareInfo()
            ]);

            this.renderDashboard(nodeData, podData, hardwareData);

            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard').style.display = 'grid';
        } catch (error) {
            console.error('データ取得エラー:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
        }
    }

    async fetchNodeMetrics() {
        const queries = [
            'DCGM_FI_DEV_GPU_UTIL',
            'DCGM_FI_DEV_MEM_COPY_UTIL',
            'DCGM_FI_DEV_FB_USED',
            'DCGM_FI_DEV_FB_TOTAL',
            'DCGM_FI_DEV_POWER_USAGE',
            'DCGM_FI_DEV_GPU_TEMP'
        ];

        const results = {};
        for (const query of queries) {
            try {
                const response = await fetch(`${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                results[query] = data.data.result;
            } catch (error) {
                console.warn(`クエリ ${query} の取得に失敗:`, error);
                results[query] = [];
            }
        }

        return this.processNodeData(results);
    }

    async fetchPodMetrics() {
        const query = 'DCGM_FI_DEV_GPU_UTIL{pod!=""}';
        try {
            const response = await fetch(`${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            return this.processPodData(data.data.result);
        } catch (error) {
            console.warn('ポッドメトリクスの取得に失敗:', error);
            return [];
        }
    }

    async fetchHardwareInfo() {
        const queries = [
            'DCGM_FI_DRIVER_VERSION',
            'DCGM_FI_NVML_VERSION',
            'DCGM_FI_DEV_NAME',
            'DCGM_FI_DEV_BRAND',
            'DCGM_FI_DEV_SERIAL',
            'DCGM_FI_DEV_UUID',
            'DCGM_FI_DEV_MINOR_NUMBER',
            'DCGM_FI_DEV_OEM_INFOROM_VER',
            'DCGM_FI_DEV_PCI_BUSID',
            'DCGM_FI_DEV_FB_TOTAL',
            'DCGM_FI_DEV_BAR1_TOTAL',
            'DCGM_FI_DEV_CC_MAJOR',
            'DCGM_FI_DEV_CC_MINOR',
            'DCGM_FI_DEV_MULTIPROCESSOR_COUNT',
            'DCGM_FI_DEV_MEMORY_BUS_WIDTH',
            'DCGM_FI_DEV_MAX_MEM_CLOCK',
            'DCGM_FI_DEV_MAX_SM_CLOCK',
            'DCGM_FI_DEV_POWER_MGMT_LIMIT',
            'DCGM_FI_DEV_POWER_MGMT_LIMIT_MIN',
            'DCGM_FI_DEV_POWER_MGMT_LIMIT_MAX'
        ];

        const results = {};
        for (const query of queries) {
            try {
                const response = await fetch(`${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                results[query] = data.data.result;
            } catch (error) {
                console.warn(`ハードウェア情報クエリ ${query} の取得に失敗:`, error);
                results[query] = [];
            }
        }

        return this.processHardwareData(results);
    }

    processNodeData(results) {
        const nodes = new Map();

        // GPU使用率でノードを初期化
        results['DCGM_FI_DEV_GPU_UTIL']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const nodeKey = `${node}`;
            
            if (!nodes.has(nodeKey)) {
                nodes.set(nodeKey, {
                    name: node,
                    gpus: new Map(),
                    status: 'online'
                });
            }

            nodes.get(nodeKey).gpus.set(gpu, {
                id: gpu,
                utilization: parseFloat(metric.value[1]) || 0,
                memoryUsed: 0,
                memoryTotal: 0,
                power: 0,
                temperature: 0
            });
        });

        // メモリ使用量を追加
        results['DCGM_FI_DEV_FB_USED']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const nodeKey = `${node}`;
            
            if (nodes.has(nodeKey) && nodes.get(nodeKey).gpus.has(gpu)) {
                nodes.get(nodeKey).gpus.get(gpu).memoryUsed = parseFloat(metric.value[1]) || 0;
            }
        });

        // メモリ総量を追加
        results['DCGM_FI_DEV_FB_TOTAL']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const nodeKey = `${node}`;
            
            if (nodes.has(nodeKey) && nodes.get(nodeKey).gpus.has(gpu)) {
                nodes.get(nodeKey).gpus.get(gpu).memoryTotal = parseFloat(metric.value[1]) || 0;
            }
        });

        // 電力使用量を追加
        results['DCGM_FI_DEV_POWER_USAGE']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const nodeKey = `${node}`;
            
            if (nodes.has(nodeKey) && nodes.get(nodeKey).gpus.has(gpu)) {
                nodes.get(nodeKey).gpus.get(gpu).power = parseFloat(metric.value[1]) || 0;
            }
        });

        // 温度を追加
        results['DCGM_FI_DEV_GPU_TEMP']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const nodeKey = `${node}`;
            
            if (nodes.has(nodeKey) && nodes.get(nodeKey).gpus.has(gpu)) {
                nodes.get(nodeKey).gpus.get(gpu).temperature = parseFloat(metric.value[1]) || 0;
            }
        });

        return Array.from(nodes.values());
    }

    processPodData(results) {
        const pods = new Map();

        results.forEach(metric => {
            const podName = metric.metric.pod || metric.metric.kubernetes_pod_name || 'unknown';
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const utilization = parseFloat(metric.value[1]) || 0;

            const podKey = `${podName}-${node}`;
            
            if (!pods.has(podKey)) {
                pods.set(podKey, {
                    name: podName,
                    node: node,
                    gpus: new Map()
                });
            }

            pods.get(podKey).gpus.set(gpu, {
                id: gpu,
                utilization: utilization
            });
        });

        return Array.from(pods.values());
    }

    processHardwareData(results) {
        const hardware = new Map();

        // GPU名でハードウェア情報を初期化
        results['DCGM_FI_DEV_NAME']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const gpu = metric.metric.gpu || metric.metric.GPU || '0';
            const gpuName = metric.value[1] || 'Unknown GPU';
            const nodeKey = `${node}`;
            
            if (!hardware.has(nodeKey)) {
                hardware.set(nodeKey, {
                    node: node,
                    gpus: new Map(),
                    driverVersion: '',
                    nvmlVersion: ''
                });
            }

            hardware.get(nodeKey).gpus.set(gpu, {
                id: gpu,
                name: gpuName,
                brand: '',
                serial: '',
                uuid: '',
                pciBusId: '',
                memoryTotal: 0,
                bar1Total: 0,
                computeCapabilityMajor: 0,
                computeCapabilityMinor: 0,
                multiprocessorCount: 0,
                memoryBusWidth: 0,
                maxMemoryClock: 0,
                maxSmClock: 0,
                powerLimit: 0,
                powerLimitMin: 0,
                powerLimitMax: 0
            });
        });

        // 各種ハードウェア情報を追加
        const fieldMapping = {
            'DCGM_FI_DEV_BRAND': 'brand',
            'DCGM_FI_DEV_SERIAL': 'serial',
            'DCGM_FI_DEV_UUID': 'uuid',
            'DCGM_FI_DEV_PCI_BUSID': 'pciBusId',
            'DCGM_FI_DEV_FB_TOTAL': 'memoryTotal',
            'DCGM_FI_DEV_BAR1_TOTAL': 'bar1Total',
            'DCGM_FI_DEV_CC_MAJOR': 'computeCapabilityMajor',
            'DCGM_FI_DEV_CC_MINOR': 'computeCapabilityMinor',
            'DCGM_FI_DEV_MULTIPROCESSOR_COUNT': 'multiprocessorCount',
            'DCGM_FI_DEV_MEMORY_BUS_WIDTH': 'memoryBusWidth',
            'DCGM_FI_DEV_MAX_MEM_CLOCK': 'maxMemoryClock',
            'DCGM_FI_DEV_MAX_SM_CLOCK': 'maxSmClock',
            'DCGM_FI_DEV_POWER_MGMT_LIMIT': 'powerLimit',
            'DCGM_FI_DEV_POWER_MGMT_LIMIT_MIN': 'powerLimitMin',
            'DCGM_FI_DEV_POWER_MGMT_LIMIT_MAX': 'powerLimitMax'
        };

        Object.entries(fieldMapping).forEach(([query, field]) => {
            results[query]?.forEach(metric => {
                const node = metric.metric.node || metric.metric.instance || 'unknown';
                const gpu = metric.metric.gpu || metric.metric.GPU || '0';
                const nodeKey = `${node}`;
                
                if (hardware.has(nodeKey) && hardware.get(nodeKey).gpus.has(gpu)) {
                    const value = metric.value[1];
                    if (typeof value === 'string' && isNaN(value)) {
                        hardware.get(nodeKey).gpus.get(gpu)[field] = value;
                    } else {
                        hardware.get(nodeKey).gpus.get(gpu)[field] = parseFloat(value) || 0;
                    }
                }
            });
        });

        // ドライバーバージョン情報を追加
        results['DCGM_FI_DRIVER_VERSION']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const nodeKey = `${node}`;
            
            if (hardware.has(nodeKey)) {
                hardware.get(nodeKey).driverVersion = metric.value[1] || '';
            }
        });

        results['DCGM_FI_NVML_VERSION']?.forEach(metric => {
            const node = metric.metric.node || metric.metric.instance || 'unknown';
            const nodeKey = `${node}`;
            
            if (hardware.has(nodeKey)) {
                hardware.get(nodeKey).nvmlVersion = metric.value[1] || '';
            }
        });

        return Array.from(hardware.values());
    }

    renderDashboard(nodeData, podData, hardwareData) {
        const dashboard = document.getElementById('dashboard');
        dashboard.innerHTML = '';

        // サマリーカードを表示
        const summaryCard = this.createSummaryCard(nodeData, podData);
        dashboard.appendChild(summaryCard);

        // ハードウェア情報カードを表示
        if (hardwareData && hardwareData.length > 0) {
            const hardwareCard = this.createHardwareCard(hardwareData);
            dashboard.appendChild(hardwareCard);
        }

        // ノード情報を表示
        nodeData.forEach(node => {
            const nodeCard = this.createNodeCard(node);
            dashboard.appendChild(nodeCard);
        });

        // ポッド情報を表示
        if (podData.length > 0) {
            const podCard = this.createPodCard(podData);
            dashboard.appendChild(podCard);
        }
    }

    createNodeCard(node) {
        const card = document.createElement('div');
        card.className = 'card';

        const gpuList = Array.from(node.gpus.values());
        const avgUtilization = gpuList.reduce((sum, gpu) => sum + gpu.utilization, 0) / gpuList.length || 0;

        card.innerHTML = `
            <h3>🖥️ ノード: ${node.name}</h3>
            <div class="metric">
                <span class="metric-label">ステータス</span>
                <span class="status ${node.status}">${node.status === 'online' ? 'オンライン' : 'オフライン'}</span>
            </div>
            <div class="metric">
                <span class="metric-label">GPU数</span>
                <span class="metric-value">${gpuList.length}</span>
            </div>
            <div class="metric">
                <span class="metric-label">平均GPU使用率</span>
                <span class="metric-value">${avgUtilization.toFixed(1)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${avgUtilization}%"></div>
            </div>
            ${gpuList.map(gpu => `
                <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                    <strong>GPU ${gpu.id}</strong>
                    <div class="metric">
                        <span class="metric-label">使用率</span>
                        <span class="metric-value">${gpu.utilization.toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">メモリ</span>
                        <span class="metric-value">${(gpu.memoryUsed / 1024 / 1024).toFixed(0)}MB / ${(gpu.memoryTotal / 1024 / 1024).toFixed(0)}MB</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">電力</span>
                        <span class="metric-value">${gpu.power.toFixed(1)}W</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">温度</span>
                        <span class="metric-value">${gpu.temperature.toFixed(1)}°C</span>
                    </div>
                </div>
            `).join('')}
        `;

        return card;
    }

    createHardwareCard(hardwareData) {
        const card = document.createElement('div');
        card.className = 'card';

        // 全GPUの統計情報を計算
        let totalGPUs = 0;
        let gpuModels = new Map();
        let totalMemory = 0;
        let driverVersions = new Set();

        hardwareData.forEach(nodeHw => {
            totalGPUs += nodeHw.gpus.size;
            if (nodeHw.driverVersion) {
                driverVersions.add(nodeHw.driverVersion);
            }

            Array.from(nodeHw.gpus.values()).forEach(gpu => {
                // GPU モデル別の集計
                const modelKey = gpu.name || 'Unknown';
                if (!gpuModels.has(modelKey)) {
                    gpuModels.set(modelKey, {
                        count: 0,
                        totalMemory: 0,
                        computeCapability: '',
                        powerLimit: 0
                    });
                }
                const model = gpuModels.get(modelKey);
                model.count++;
                model.totalMemory += gpu.memoryTotal;
                if (gpu.computeCapabilityMajor && gpu.computeCapabilityMinor) {
                    model.computeCapability = `${gpu.computeCapabilityMajor}.${gpu.computeCapabilityMinor}`;
                }
                if (gpu.powerLimit > model.powerLimit) {
                    model.powerLimit = gpu.powerLimit;
                }

                totalMemory += gpu.memoryTotal;
            });
        });

        card.innerHTML = `
            <h3>🔧 ハードウェア情報</h3>
            
            <div class="metric">
                <span class="metric-label">総GPU数</span>
                <span class="metric-value">${totalGPUs}</span>
            </div>
            
            <div class="metric">
                <span class="metric-label">総GPU メモリ</span>
                <span class="metric-value">${(totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB</span>
            </div>
            
            ${driverVersions.size > 0 ? `
                <div class="metric">
                    <span class="metric-label">NVIDIA ドライバー</span>
                    <span class="metric-value">${Array.from(driverVersions).join(', ')}</span>
                </div>
            ` : ''}

            <div style="margin-top: 20px;">
                <h4 style="color: #667eea; margin-bottom: 15px;">📊 GPU モデル別詳細</h4>
                ${Array.from(gpuModels.entries()).map(([model, info]) => `
                    <div style="margin-bottom: 15px; padding: 15px; background: rgba(102, 126, 234, 0.05); border-radius: 8px; border-left: 4px solid #667eea;">
                        <div style="font-weight: bold; color: #333; margin-bottom: 10px;">
                            ${model} × ${info.count}
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.9rem;">
                            <div>
                                <span style="color: #666;">メモリ/GPU:</span>
                                <span style="font-weight: 600; color: #667eea;">
                                    ${(info.totalMemory / info.count / 1024 / 1024 / 1024).toFixed(1)} GB
                                </span>
                            </div>
                            ${info.computeCapability ? `
                                <div>
                                    <span style="color: #666;">Compute Capability:</span>
                                    <span style="font-weight: 600; color: #667eea;">${info.computeCapability}</span>
                                </div>
                            ` : ''}
                            ${info.powerLimit > 0 ? `
                                <div>
                                    <span style="color: #666;">電力制限:</span>
                                    <span style="font-weight: 600; color: #667eea;">${info.powerLimit.toFixed(0)} W</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${hardwareData.length > 0 ? `
                <div style="margin-top: 20px;">
                    <h4 style="color: #667eea; margin-bottom: 15px;">🖥️ ノード別詳細</h4>
                    ${hardwareData.map(nodeHw => `
                        <div style="margin-bottom: 15px; padding: 15px; background: rgba(0,0,0,0.03); border-radius: 8px;">
                            <div style="font-weight: bold; color: #333; margin-bottom: 10px;">
                                ノード: ${nodeHw.node}
                            </div>
                            ${Array.from(nodeHw.gpus.values()).map(gpu => `
                                <div style="margin-bottom: 10px; padding: 10px; background: white; border-radius: 6px; border: 1px solid #e0e0e0;">
                                    <div style="font-weight: 600; color: #667eea; margin-bottom: 8px;">
                                        GPU ${gpu.id}: ${gpu.name}
                                    </div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 0.85rem;">
                                        ${gpu.brand ? `
                                            <div><span style="color: #666;">ブランド:</span> ${gpu.brand}</div>
                                        ` : ''}
                                        ${gpu.memoryTotal > 0 ? `
                                            <div><span style="color: #666;">メモリ:</span> ${(gpu.memoryTotal / 1024 / 1024 / 1024).toFixed(1)} GB</div>
                                        ` : ''}
                                        ${gpu.computeCapabilityMajor ? `
                                            <div><span style="color: #666;">Compute:</span> ${gpu.computeCapabilityMajor}.${gpu.computeCapabilityMinor}</div>
                                        ` : ''}
                                        ${gpu.multiprocessorCount > 0 ? `
                                            <div><span style="color: #666;">SM数:</span> ${gpu.multiprocessorCount}</div>
                                        ` : ''}
                                        ${gpu.memoryBusWidth > 0 ? `
                                            <div><span style="color: #666;">メモリバス:</span> ${gpu.memoryBusWidth} bit</div>
                                        ` : ''}
                                        ${gpu.maxMemoryClock > 0 ? `
                                            <div><span style="color: #666;">メモリクロック:</span> ${gpu.maxMemoryClock} MHz</div>
                                        ` : ''}
                                        ${gpu.maxSmClock > 0 ? `
                                            <div><span style="color: #666;">SMクロック:</span> ${gpu.maxSmClock} MHz</div>
                                        ` : ''}
                                        ${gpu.powerLimit > 0 ? `
                                            <div><span style="color: #666;">電力制限:</span> ${gpu.powerLimit} W</div>
                                        ` : ''}
                                        ${gpu.pciBusId ? `
                                            <div><span style="color: #666;">PCI Bus:</span> ${gpu.pciBusId}</div>
                                        ` : ''}
                                        ${gpu.uuid ? `
                                            <div style="grid-column: 1 / -1;"><span style="color: #666;">UUID:</span> <code style="font-size: 0.8rem;">${gpu.uuid}</code></div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;

        return card;
    }

    createPodCard(podData) {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
            <h3>🚀 ポッド GPU使用状況</h3>
            ${podData.map(pod => `
                <div style="margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                    <strong>${pod.name}</strong>
                    <div class="metric">
                        <span class="metric-label">ノード</span>
                        <span class="metric-value">${pod.node}</span>
                    </div>
                    ${Array.from(pod.gpus.values()).map(gpu => `
                        <div class="metric">
                            <span class="metric-label">GPU ${gpu.id} 使用率</span>
                            <span class="metric-value">${gpu.utilization.toFixed(1)}%</span>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;

        return card;
    }

    createSummaryCard(nodeData, podData) {
        const card = document.createElement('div');
        card.className = 'card';

        const totalGPUs = nodeData.reduce((sum, node) => sum + node.gpus.size, 0);
        const totalPods = podData.length;
        const avgUtilization = nodeData.reduce((sum, node) => {
            const nodeAvg = Array.from(node.gpus.values()).reduce((s, gpu) => s + gpu.utilization, 0) / node.gpus.size || 0;
            return sum + nodeAvg;
        }, 0) / nodeData.length || 0;

        card.innerHTML = `
            <h3>📊 クラスター概要</h3>
            <div class="metric">
                <span class="metric-label">総ノード数</span>
                <span class="metric-value">${nodeData.length}</span>
            </div>
            <div class="metric">
                <span class="metric-label">総GPU数</span>
                <span class="metric-value">${totalGPUs}</span>
            </div>
            <div class="metric">
                <span class="metric-label">GPU使用ポッド数</span>
                <span class="metric-value">${totalPods}</span>
            </div>
            <div class="metric">
                <span class="metric-label">平均GPU使用率</span>
                <span class="metric-value">${avgUtilization.toFixed(1)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${avgUtilization}%"></div>
            </div>
            <div style="margin-top: 15px; font-size: 0.9rem; color: #666;">
                最終更新: ${new Date().toLocaleString('ja-JP')}
            </div>
        `;

        return card;
    }

    startAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
        
        this.autoRefreshTimer = setInterval(() => {
            this.loadData();
        }, this.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
    }
}

// グローバル関数
function refreshData() {
    if (window.gpuMonitor) {
        window.gpuMonitor.loadData();
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    window.gpuMonitor = new GPUMonitor();
});

// ページを離れる時に自動更新を停止
window.addEventListener('beforeunload', () => {
    if (window.gpuMonitor) {
        window.gpuMonitor.stopAutoRefresh();
    }
});