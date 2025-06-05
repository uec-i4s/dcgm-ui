#!/bin/bash

# GPU監視モニターのデプロイスクリプト

set -e

echo "🚀 GPU監視モニターをデプロイしています..."

# 名前空間の作成
echo "📦 名前空間を作成中..."
kubectl apply -f k8s/namespace.yaml

# DCGM Exporterのデプロイ
echo "🔧 DCGM Exporterをデプロイ中..."
kubectl apply -f k8s/dcgm-exporter.yaml

# Prometheusのデプロイ
echo "📊 Prometheusをデプロイ中..."
kubectl apply -f k8s/prometheus.yaml

# WebUIのデプロイ
echo "🌐 WebUIをデプロイ中..."
kubectl apply -f k8s/web-ui.yaml

echo "⏳ ポッドの起動を待機中..."
kubectl wait --for=condition=ready pod -l app=dcgm-exporter -n gpu-monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=prometheus -n gpu-monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=gpu-monitor-ui -n gpu-monitoring --timeout=300s

echo "✅ デプロイが完了しました！"
echo ""
echo "📋 デプロイされたリソース:"
kubectl get all -n gpu-monitoring

echo ""
echo "🌐 WebUIにアクセスするには以下のコマンドを実行してください:"
echo "kubectl port-forward service/gpu-monitor-ui 8080:80 -n gpu-monitoring"
echo ""
echo "その後、ブラウザで http://localhost:8080 にアクセスしてください。"
echo ""
echo "📊 Prometheusに直接アクセスするには:"
echo "kubectl port-forward service/prometheus 9090:9090 -n gpu-monitoring"
echo ""
echo "🔍 ログを確認するには:"
echo "kubectl logs -l app=dcgm-exporter -n gpu-monitoring"
echo "kubectl logs -l app=prometheus -n gpu-monitoring"
echo "kubectl logs -l app=gpu-monitor-ui -n gpu-monitoring"