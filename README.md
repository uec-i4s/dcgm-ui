# GPU監視モニター

NVIDIA DCGM Exporterを使用したKubernetesクラスターのGPU使用量監視システム

## 概要

このプロジェクトは、Kubernetesクラスター上でGPU使用量をノードとポッドごとに監視するためのシステムです。

## 構成要素

- DCGM Exporter: GPUメトリクスの収集
- Prometheus: メトリクスの保存
- Grafana: 可視化ダッシュボード
- Web UI: 簡易的な監視インターフェース

## 使用方法

1. Kubernetesクラスターにデプロイ
```bash
kubectl apply -f k8s/
```

2. Web UIにアクセス
```bash
kubectl port-forward service/gpu-monitor-ui 8080:80
```

3. ブラウザで http://localhost:8080 にアクセス

## 必要な要件

- Kubernetesクラスター
- NVIDIA GPU搭載ノード
- NVIDIA Device Plugin for Kubernetes