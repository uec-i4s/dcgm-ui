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

            const [nodeData, podData] = await Promise.all([
                this.fetchNodeMetrics(),
                this.fetchPodMetrics()
            ]);

            this.renderDashboard(nodeData, podData);

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

    renderDashboard(nodeData, podData) {
        const dashboard = document.getElementById('dashboard');
        dashboard.innerHTML = '';

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

        // サマリーカードを表示
        const summaryCard = this.createSummaryCard(nodeData, podData);
        dashboard.insertBefore(summaryCard, dashboard.firstChild);
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