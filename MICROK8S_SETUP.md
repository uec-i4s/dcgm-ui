# MicroK8s GPU監視モニター セットアップガイド

## 🚀 MicroK8s環境での完全セットアップ

### 1. MicroK8sのインストール

#### Ubuntu/Debian
```bash
# Snapを使用してMicroK8sをインストール
sudo snap install microk8s --classic

# 現在のユーザーをmicrok8sグループに追加
sudo usermod -a -G microk8s $USER
sudo chown -f -R $USER ~/.kube

# グループ変更を反映（再ログインまたは以下のコマンド）
newgrp microk8s
```

#### その他のディストリビューション
```bash
# Snapが利用できない場合は、公式ドキュメントを参照
# https://microk8s.io/docs/getting-started
```

### 2. MicroK8sの初期設定

```bash
# MicroK8sの状態確認
microk8s status --wait-ready

# 基本的なアドオンを有効化
microk8s enable dns
microk8s enable storage

# GPUアドオンを有効化（重要）
microk8s enable gpu

# 状態確認
microk8s status
```

### 3. NVIDIA環境の確認

```bash
# ホストでNVIDIA ドライバーの確認
nvidia-smi

# MicroK8sでGPUが認識されているか確認
microk8s kubectl get nodes -o yaml | grep nvidia.com/gpu

# GPU Device Pluginの確認
microk8s kubectl get pods -n kube-system | grep nvidia
```

### 4. GPU監視モニターのデプロイ

```bash
# このリポジトリをクローン
git clone <repository-url>
cd dcgm-ui

# MicroK8s対応デプロイスクリプトを実行
./deploy.sh

# デプロイ状況の確認
microk8s kubectl get all -n gpu-monitoring
```

### 5. アクセス確認

```bash
# WebUIにアクセス
microk8s kubectl port-forward service/gpu-monitor-ui 8080:80 -n gpu-monitoring

# 別ターミナルでPrometheusにアクセス
microk8s kubectl port-forward service/prometheus 9090:9090 -n gpu-monitoring
```

ブラウザで以下にアクセス：
- GPU監視UI: http://localhost:8080
- Prometheus: http://localhost:9090

## 🔧 MicroK8s固有のトラブルシューティング

### 問題1: GPUアドオンが有効化できない

```bash
# MicroK8sのバージョン確認
microk8s version

# アドオンの状態確認
microk8s status

# GPUアドオンを強制的に再有効化
microk8s disable gpu
microk8s enable gpu

# NVIDIA Container Runtimeの確認
microk8s kubectl describe nodes | grep -A 10 "Container Runtime"
```

### 問題2: ポッドがPending状態

```bash
# ノードの状態確認
microk8s kubectl describe nodes

# リソース使用状況確認
microk8s kubectl top nodes

# イベント確認
microk8s kubectl get events -n gpu-monitoring --sort-by='.lastTimestamp'
```

### 問題3: ネットワーク接続の問題

```bash
# DNSアドオンの確認
microk8s status | grep dns

# CoreDNSの状態確認
microk8s kubectl get pods -n kube-system | grep coredns

# ネットワーク設定の確認
microk8s kubectl get svc -A
```

## 📊 MicroK8s環境での監視コマンド

### 基本的な監視
```bash
# 全体の状況確認
microk8s kubectl get all -n gpu-monitoring

# ポッドの詳細状況
microk8s kubectl describe pods -n gpu-monitoring

# リソース使用状況
microk8s kubectl top pods -n gpu-monitoring
```

### GPU固有の監視
```bash
# GPUリソースの確認
microk8s kubectl describe nodes | grep -A 5 "nvidia.com/gpu"

# GPU使用中のポッド確認
microk8s kubectl get pods -A -o wide | grep nvidia

# DCGM Exporterのメトリクス確認
microk8s kubectl port-forward service/dcgm-exporter 9400:9400 -n gpu-monitoring
curl http://localhost:9400/metrics | grep DCGM_FI_DEV_GPU_UTIL
```

### ログ監視
```bash
# リアルタイムログ監視
microk8s kubectl logs -f -l app=dcgm-exporter -n gpu-monitoring

# 全コンポーネントのログ
microk8s kubectl logs -l app=prometheus -n gpu-monitoring --tail=50
microk8s kubectl logs -l app=gpu-monitor-ui -n gpu-monitoring --tail=50
```

## 🔄 アップデートとメンテナンス

### MicroK8sのアップデート
```bash
# MicroK8sのアップデート
sudo snap refresh microk8s

# アドオンの再有効化（必要に応じて）
microk8s enable gpu
```

### 監視システムのアップデート
```bash
# 既存のデプロイメントを削除
./cleanup.sh

# 最新版を再デプロイ
./deploy.sh
```

## 🎯 パフォーマンス最適化

### リソース制限の調整
```bash
# ノードのリソース確認
microk8s kubectl describe nodes | grep -A 10 "Allocated resources"

# 必要に応じてk8s/prometheus.yamlのresources設定を調整
# 小規模環境の場合：
# requests: cpu: 100m, memory: 500Mi
# limits: cpu: 500m, memory: 1Gi
```

### ストレージの最適化
```bash
# ストレージ使用状況確認
microk8s kubectl get pv
microk8s kubectl get pvc -A

# Prometheusのデータ保持期間調整（k8s/prometheus.yaml）
# --storage.tsdb.retention.time=72h  # 3日間に短縮
```

## 🔗 参考リンク

- [MicroK8s公式ドキュメント](https://microk8s.io/docs)
- [MicroK8s GPU アドオン](https://microk8s.io/docs/addon-gpu)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- [DCGM Exporter](https://docs.nvidia.com/datacenter/cloud-native/gpu-telemetry/dcgm-exporter.html)