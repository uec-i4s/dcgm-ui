#!/bin/bash

# GPU監視モニター（外部アクセス対応）のデプロイスクリプト

set -e

echo "🚀 GPU監視モニター（外部アクセス対応）をデプロイしています..."

# MicroK8s環境の確認
if ! command -v microk8s &> /dev/null; then
    echo "❌ MicroK8sが見つかりません。MicroK8sがインストールされていることを確認してください。"
    exit 1
fi

KUBECTL_CMD="microk8s kubectl"

# 必要なアドオンの確認と有効化
echo "🔧 必要なMicroK8sアドオンを確認中..."

# GPUアドオンの確認
if ! microk8s status | grep -q "gpu: enabled"; then
    echo "📦 GPUアドオンを有効化中..."
    microk8s enable gpu
fi

# DNS アドオンの確認
if ! microk8s status | grep -q "dns: enabled"; then
    echo "📦 DNSアドオンを有効化中..."
    microk8s enable dns
fi

# Storage アドオンの確認
if ! microk8s status | grep -q "storage: enabled"; then
    echo "📦 Storageアドオンを有効化中..."
    microk8s enable storage
fi

# MetalLBアドオンの確認（LoadBalancer用）
if ! microk8s status | grep -q "metallb: enabled"; then
    echo "🔗 MetalLBアドオンを有効化中..."
    read -p "MetalLBのIPアドレス範囲を入力してください (例: 192.168.1.240-192.168.1.250): " IP_RANGE
    if [ -n "$IP_RANGE" ]; then
        microk8s enable metallb:$IP_RANGE
    else
        echo "⚠️  MetalLBの設定をスキップします。NodePortでアクセスしてください。"
    fi
fi

# GPUノードにラベルを追加
echo "🏷️  GPUノードにラベルを追加中..."
$KUBECTL_CMD label nodes --all accelerator=nvidia --overwrite

# 基本コンポーネントのデプロイ
echo "📦 基本コンポーネントをデプロイ中..."
$KUBECTL_CMD apply -f k8s/namespace.yaml
$KUBECTL_CMD apply -f k8s/dcgm-exporter.yaml
$KUBECTL_CMD apply -f k8s/prometheus.yaml
$KUBECTL_CMD apply -f k8s/web-ui.yaml

# 外部アクセス設定のデプロイ
echo "🌐 外部アクセス設定をデプロイ中..."
$KUBECTL_CMD apply -f k8s/external-access.yaml

echo "⏳ ポッドの起動を待機中..."
$KUBECTL_CMD wait --for=condition=ready pod -l app=dcgm-exporter -n gpu-monitoring --timeout=300s || echo "⚠️  DCGM Exporterの起動に時間がかかっています..."
$KUBECTL_CMD wait --for=condition=ready pod -l app=prometheus -n gpu-monitoring --timeout=300s || echo "⚠️  Prometheusの起動に時間がかかっています..."
$KUBECTL_CMD wait --for=condition=ready pod -l app=gpu-monitor-ui -n gpu-monitoring --timeout=300s || echo "⚠️  WebUIの起動に時間がかかっています..."

echo "✅ デプロイが完了しました！"
echo ""
echo "📋 デプロイされたリソース:"
$KUBECTL_CMD get all -n gpu-monitoring

echo ""
echo "🌐 外部アクセス方法:"
echo ""

# NodePortでのアクセス方法
NODE_IP=$($KUBECTL_CMD get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
echo "1. NodePort経由でのアクセス:"
echo "   http://${NODE_IP}:30080"
echo ""

# LoadBalancerでのアクセス方法
EXTERNAL_IP=$($KUBECTL_CMD get svc gpu-monitor-ui-external -n gpu-monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$EXTERNAL_IP" ] && [ "$EXTERNAL_IP" != "null" ]; then
    echo "2. LoadBalancer経由でのアクセス:"
    echo "   http://${EXTERNAL_IP}:8080"
    echo ""
fi

# MetalLBでのアクセス方法
METALLB_IP=$($KUBECTL_CMD get svc gpu-monitor-ui-metallb -n gpu-monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$METALLB_IP" ] && [ "$METALLB_IP" != "null" ]; then
    echo "3. MetalLB経由でのアクセス:"
    echo "   http://${METALLB_IP}:8080"
    echo ""
fi

# HostNetworkでのアクセス方法
if $KUBECTL_CMD get deployment gpu-monitor-ui-hostnetwork -n gpu-monitoring >/dev/null 2>&1; then
    echo "4. HostNetwork経由でのアクセス:"
    echo "   http://${NODE_IP}:8080"
    echo ""
fi

echo "📊 Prometheusに直接アクセスするには:"
echo "microk8s kubectl port-forward service/prometheus 9090:9090 -n gpu-monitoring"
echo ""

echo "🔍 サービス状況の確認:"
echo "$KUBECTL_CMD get svc -n gpu-monitoring"
echo ""

echo "🔧 トラブルシューティング:"
echo "ログ確認: $KUBECTL_CMD logs -l app=gpu-monitor-ui -n gpu-monitoring"
echo "ポッド状況: $KUBECTL_CMD get pods -n gpu-monitoring"
echo "サービス詳細: $KUBECTL_CMD describe svc -n gpu-monitoring"