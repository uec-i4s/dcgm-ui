#!/bin/bash

# GPU監視モニターのデバッグスクリプト

echo "🔍 GPU監視モニターのトラブルシューティング"
echo "============================================"

KUBECTL_CMD="microk8s kubectl"

echo ""
echo "📋 ポッドの状態確認:"
$KUBECTL_CMD get pods -n gpu-monitoring -o wide

echo ""
echo "📋 ポッドの詳細情報:"
$KUBECTL_CMD describe pods -n gpu-monitoring

echo ""
echo "📋 イベント確認:"
$KUBECTL_CMD get events -n gpu-monitoring --sort-by='.lastTimestamp'

echo ""
echo "📋 ノードの状態確認:"
$KUBECTL_CMD get nodes -o wide

echo ""
echo "📋 ノードのGPU情報:"
$KUBECTL_CMD describe nodes | grep -A 10 nvidia.com/gpu

echo ""
echo "📋 DCGM Exporterのログ:"
$KUBECTL_CMD logs -l app=dcgm-exporter -n gpu-monitoring --tail=50 || echo "DCGM Exporterのログが取得できません"

echo ""
echo "📋 Prometheusのログ:"
$KUBECTL_CMD logs -l app=prometheus -n gpu-monitoring --tail=50 || echo "Prometheusのログが取得できません"

echo ""
echo "📋 WebUIのログ:"
$KUBECTL_CMD logs -l app=gpu-monitor-ui -n gpu-monitoring --tail=50 || echo "WebUIのログが取得できません"

echo ""
echo "📋 MicroK8sの状態:"
microk8s status

echo ""
echo "📋 MicroK8s GPUアドオンの確認:"
microk8s status | grep gpu

echo ""
echo "📋 NVIDIA Device Pluginの確認:"
$KUBECTL_CMD get pods -n kube-system | grep nvidia || echo "NVIDIA Device Pluginが見つかりません"

echo ""
echo "📋 ホストのNVIDIA情報:"
nvidia-smi || echo "nvidia-smiが利用できません"

echo ""
echo "🔧 推奨される修正手順:"
echo "1. MicroK8s GPUアドオンの有効化: microk8s enable gpu"
echo "2. ノードラベルの確認: $KUBECTL_CMD get nodes --show-labels | grep nvidia"
echo "3. ポッドの再起動: $KUBECTL_CMD delete pods --all -n gpu-monitoring"
echo "4. リソース制限の確認: $KUBECTL_CMD describe nodes | grep -A 5 'Allocated resources'"