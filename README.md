# GPU監視モニター

NVIDIA DCGM Exporterを使用したKubernetesクラスターのGPU使用量監視システム

## 概要

このプロジェクトは、Kubernetesクラスター上でGPU使用量をノードとポッドごとに監視するためのシステムです。リアルタイムでGPU使用率、メモリ使用量、電力消費、温度などの詳細なメトリクスを可視化します。

## 🚀 特徴

- **リアルタイム監視**: 30秒間隔でGPUメトリクスを自動更新
- **ノード別表示**: 各ノードのGPU使用状況を個別に表示
- **ポッド別表示**: GPU使用中のポッドごとの使用率を表示
- **詳細メトリクス**: GPU使用率、メモリ、電力、温度を監視
- **レスポンシブUI**: モバイルデバイスにも対応した美しいインターフェース
- **簡単デプロイ**: ワンコマンドでの簡単なデプロイメント

## 🏗️ 構成要素

- **DCGM Exporter**: NVIDIA GPUメトリクスの収集（nvcr.io/nvidia/k8s/dcgm-exporter:4.2.3-4.1.1-ubi9）
- **Prometheus**: メトリクスの保存と管理
- **Web UI**: 直感的な監視インターフェース（Nginx + JavaScript）

## 📋 必要な要件

- **MicroK8s**（v1.20以上推奨）
- **NVIDIA GPU搭載ノード**
- **NVIDIA ドライバー**（ホストにインストール済み）
- **microk8s コマンドラインツール**

## 🚀 クイックスタート

### 1. MicroK8s環境の準備

```bash
# MicroK8sのインストール（Ubuntu/Debian）
sudo snap install microk8s --classic

# 現在のユーザーをmicrok8sグループに追加
sudo usermod -a -G microk8s $USER
sudo chown -f -R $USER ~/.kube
newgrp microk8s

# MicroK8sの状態確認
microk8s status
```

### 2. 前提条件の確認

```bash
# GPUアドオンの確認
microk8s status | grep gpu

# 必要なアドオンが無効の場合は有効化
microk8s enable gpu
microk8s enable dns
microk8s enable storage

# GPUノードの確認
microk8s kubectl get nodes --show-labels | grep nvidia
```

### 3. デプロイ

#### 基本デプロイ（localhost アクセスのみ）
```bash
# リポジトリをクローン
git clone <repository-url>
cd dcgm-ui

# ワンコマンドデプロイ（MicroK8s対応）
./deploy.sh
```

#### 外部アクセス対応デプロイ
```bash
# 外部からアクセス可能なデプロイ
./deploy-external.sh
```

### 4. アクセス

#### ローカルアクセス
```bash
# WebUIにアクセス（ポートフォワード）
microk8s kubectl port-forward service/gpu-monitor-ui 8080:80 -n gpu-monitoring
```

ブラウザで http://localhost:8080 にアクセス

#### 外部アクセス

**NodePort経由**
```bash
# ノードのIPアドレスを確認
microk8s kubectl get nodes -o wide

# ブラウザで http://<NODE_IP>:30080 にアクセス
```

**LoadBalancer経由（MetalLB有効時）**
```bash
# 外部IPを確認
microk8s kubectl get svc gpu-monitor-ui-metallb -n gpu-monitoring

# ブラウザで http://<EXTERNAL_IP>:8080 にアクセス
```

**HostNetwork経由**
```bash
# ホストネットワーク使用時
# ブラウザで http://<NODE_IP>:8080 にアクセス
```

## 📊 使用方法

### WebUI機能

- **クラスター概要**: 総ノード数、GPU数、使用中ポッド数の表示
- **ノード詳細**: 各ノードのGPU使用状況、メモリ、電力、温度
- **ポッド監視**: GPU使用中のポッドごとの使用率
- **自動更新**: 30秒間隔での自動データ更新
- **手動更新**: 右下の更新ボタンで即座にデータ更新

### Prometheusへの直接アクセス

```bash
microk8s kubectl port-forward service/prometheus 9090:9090 -n gpu-monitoring
```

ブラウザで http://localhost:9090 にアクセス

### 利用可能なメトリクス

- `DCGM_FI_DEV_GPU_UTIL`: GPU使用率 (%)
- `DCGM_FI_DEV_FB_USED`: GPU メモリ使用量 (MB)
- `DCGM_FI_DEV_FB_TOTAL`: GPU メモリ総量 (MB)
- `DCGM_FI_DEV_POWER_USAGE`: 電力使用量 (W)
- `DCGM_FI_DEV_GPU_TEMP`: GPU温度 (°C)

## 🔧 カスタマイズ

### メトリクス更新間隔の変更

[`web-ui/app.js`](web-ui/app.js:4) の `refreshInterval` を変更：
```javascript
this.refreshInterval = 15000; // 15秒に変更
```

### Prometheusの設定変更

[`k8s/prometheus.yaml`](k8s/prometheus.yaml:8) の `scrape_interval` を変更：
```yaml
global:
  scrape_interval: 10s  # 10秒に変更
```

### リソース制限の調整

各コンポーネントの [`resources`](k8s/prometheus.yaml:75) セクションを編集：
```yaml
resources:
  requests:
    cpu: 500m
    memory: 1000Mi
  limits:
    cpu: 1000m
    memory: 2000Mi
```

## 🗑️ アンインストール

```bash
./cleanup.sh
```

## 🔍 トラブルシューティング

詳細なトラブルシューティングガイドは [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) を参照してください。

### よくある問題

1. **DCGM Exporterが起動しない**
   - GPUノードのラベル設定を確認
   - NVIDIA Device Pluginのインストール状況を確認

2. **データが表示されない**
   - Prometheusのターゲット状態を確認
   - ネットワーク接続を確認

3. **WebUIにアクセスできない**
   - ポートフォワードの設定を確認
   - ポッドの状態を確認

## 📁 プロジェクト構造

```
dcgm-ui/
├── README.md                 # このファイル
├── TROUBLESHOOTING.md        # トラブルシューティングガイド
├── deploy.sh                 # デプロイスクリプト
├── cleanup.sh                # 削除スクリプト
├── k8s/                      # Kubernetes設定ファイル
│   ├── namespace.yaml        # 名前空間定義
│   ├── dcgm-exporter.yaml    # DCGM Exporter設定
│   ├── prometheus.yaml       # Prometheus設定
│   └── web-ui.yaml          # WebUI設定
└── web-ui/                   # WebUIソースコード
    ├── index.html           # HTMLファイル
    └── app.js               # JavaScriptファイル
```

## 🤝 貢献

プルリクエストや課題報告を歓迎します。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🔗 関連リンク

- [NVIDIA DCGM](https://developer.nvidia.com/dcgm)
- [NVIDIA Device Plugin for Kubernetes](https://github.com/NVIDIA/k8s-device-plugin)
- [Prometheus](https://prometheus.io/)
- [Kubernetes](https://kubernetes.io/)