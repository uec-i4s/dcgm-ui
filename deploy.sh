#!/bin/bash

# GPU監視モニター（MicroK8s対応）のデプロイスクリプト

set -e

echo "🚀 GPU監視モニター（MicroK8s環境）をデプロイしています..."

# MicroK8s環境の確認
echo "🔍 MicroK8s環境を確認中..."
if ! command -v microk8s &> /dev/null; then
    echo "❌ MicroK8sが見つかりません。MicroK8sがインストールされていることを確認してください。"
    exit 1
fi

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

# GPUノードにラベルを追加
echo "🏷️  GPUノードにラベルを追加中..."
microk8s kubectl label nodes --all accelerator=nvidia --overwrite

# 名前空間の作成
echo "📦 名前空間を作成中..."
microk8s kubectl apply -f k8s/namespace.yaml

# DCGM Exporterのデプロイ
echo "🔧 DCGM Exporterをデプロイ中..."
microk8s kubectl apply -f k8s/dcgm-exporter.yaml

# Prometheusのデプロイ
echo "📊 Prometheusをデプロイ中..."
microk8s kubectl apply -f k8s/prometheus.yaml

# WebUIのデプロイ
echo "🌐 WebUIをデプロイ中..."
microk8s kubectl apply -f k8s/web-ui.yaml

echo "⏳ ポッドの起動を待機中..."
microk8s kubectl wait --for=condition=ready pod -l app=dcgm-exporter -n gpu-monitoring --timeout=300s || echo "⚠️  DCGM Exporterの起動に時間がかかっています..."
microk8s kubectl wait --for=condition=ready pod -l app=prometheus -n gpu-monitoring --timeout=300s || echo "⚠️  Prometheusの起動に時間がかかっています..."
microk8s kubectl wait --for=condition=ready pod -l app=gpu-monitor-ui -n gpu-monitoring --timeout=300s || echo "⚠️  WebUIの起動に時間がかかっています..."

echo "✅ デプロイが完了しました！"
echo ""
echo "📋 デプロイされたリソース:"
microk8s kubectl get all -n gpu-monitoring

echo ""
echo "🌐 WebUIにアクセスするには以下のコマンドを実行してください:"
echo "microk8s kubectl port-forward service/gpu-monitor-ui 8080:80 -n gpu-monitoring"
echo ""
echo "その後、ブラウザで http://localhost:8080 にアクセスしてください。"
echo ""
echo "📊 Prometheusに直接アクセスするには:"
echo "microk8s kubectl port-forward service/prometheus 9090:9090 -n gpu-monitoring"
echo ""
echo "🔍 ログを確認するには:"
echo "microk8s kubectl logs -l app=dcgm-exporter -n gpu-monitoring"
echo "microk8s kubectl logs -l app=prometheus -n gpu-monitoring"
echo "microk8s kubectl logs -l app=gpu-monitor-ui -n gpu-monitoring"
echo ""
echo "🔧 MicroK8s固有のコマンド:"
echo "microk8s status                    # MicroK8sの状態確認"
echo "microk8s kubectl get nodes        # ノード一覧"
echo "microk8s kubectl describe nodes   # ノード詳細（GPU情報含む）"