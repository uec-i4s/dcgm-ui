# トラブルシューティングガイド

## 一般的な問題と解決方法

### 1. DCGM Exporterが起動しない

#### 症状
```bash
kubectl get pods -n gpu-monitoring
# dcgm-exporter-xxxxx が Pending または CrashLoopBackOff 状態
```

#### 原因と解決方法

**原因1: GPUノードが見つからない**
```bash
# ノードにGPUラベルが設定されているか確認
kubectl get nodes --show-labels | grep nvidia

# ラベルが設定されていない場合は追加
kubectl label nodes <node-name> accelerator=nvidia
```

**原因2: NVIDIA Device Pluginが未インストール**
```bash
# NVIDIA Device Pluginをインストール
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.1/nvidia-device-plugin.yml
```

**原因3: 権限不足**
```bash
# ログを確認
kubectl logs -l app=dcgm-exporter -n gpu-monitoring

# SecurityContextが適切に設定されているか確認
kubectl describe pod -l app=dcgm-exporter -n gpu-monitoring
```

### 2. Prometheusがメトリクスを収集できない

#### 症状
- WebUIでデータが表示されない
- "データの取得に失敗しました" エラー

#### 解決方法

**ステップ1: Prometheusの状態確認**
```bash
# Prometheusポッドの状態確認
kubectl get pods -l app=prometheus -n gpu-monitoring

# Prometheusのログ確認
kubectl logs -l app=prometheus -n gpu-monitoring
```

**ステップ2: ターゲット確認**
```bash
# Prometheusにアクセス
kubectl port-forward service/prometheus 9090:9090 -n gpu-monitoring

# ブラウザで http://localhost:9090/targets にアクセス
# dcgm-exporterターゲットが "UP" 状態か確認
```

**ステップ3: ネットワーク確認**
```bash
# サービスの確認
kubectl get svc -n gpu-monitoring

# エンドポイントの確認
kubectl get endpoints -n gpu-monitoring
```

### 3. WebUIにアクセスできない

#### 症状
- ブラウザでWebUIが表示されない
- 接続エラーが発生

#### 解決方法

**ステップ1: ポッドの状態確認**
```bash
kubectl get pods -l app=gpu-monitor-ui -n gpu-monitoring
kubectl logs -l app=gpu-monitor-ui -n gpu-monitoring
```

**ステップ2: サービス確認**
```bash
kubectl get svc gpu-monitor-ui -n gpu-monitoring
kubectl describe svc gpu-monitor-ui -n gpu-monitoring
```

**ステップ3: ポートフォワード確認**
```bash
# 正しいポートフォワードコマンド
kubectl port-forward service/gpu-monitor-ui 8080:80 -n gpu-monitoring

# 別のポートを試す
kubectl port-forward service/gpu-monitor-ui 8081:80 -n gpu-monitoring
```

### 4. GPUメトリクスが表示されない

#### 症状
- WebUIは表示されるがGPUデータが空

#### 解決方法

**ステップ1: DCGM Exporterメトリクス確認**
```bash
# DCGM Exporterに直接アクセス
kubectl port-forward service/dcgm-exporter 9400:9400 -n gpu-monitoring

# メトリクスを確認
curl http://localhost:9400/metrics | grep DCGM_FI_DEV_GPU_UTIL
```

**ステップ2: GPU使用中のポッド確認**
```bash
# GPU使用中のポッドを確認
kubectl get pods --all-namespaces -o wide | grep nvidia

# GPUリソースの確認
kubectl describe nodes | grep -A 5 "Allocated resources"
```

**ステップ3: メトリクス名の確認**
```bash
# 利用可能なメトリクス一覧
curl http://localhost:9400/metrics | grep DCGM_FI_DEV
```

### 5. パフォーマンスの問題

#### 症状
- WebUIの読み込みが遅い
- メトリクス更新が遅い

#### 解決方法

**ステップ1: リソース使用量確認**
```bash
kubectl top pods -n gpu-monitoring
kubectl describe pods -n gpu-monitoring
```

**ステップ2: リソース制限の調整**
```yaml
# prometheus.yamlのresources設定を調整
resources:
  requests:
    cpu: 500m
    memory: 2000Mi
  limits:
    cpu: 2000m
    memory: 4000Mi
```

**ステップ3: スクレイプ間隔の調整**
```yaml
# prometheus.yamlのscrape_interval設定を調整
global:
  scrape_interval: 30s  # デフォルト15sから変更
```

## デバッグコマンド集

### 基本的な状態確認
```bash
# 全リソースの確認
kubectl get all -n gpu-monitoring

# ポッドの詳細情報
kubectl describe pods -n gpu-monitoring

# イベントの確認
kubectl get events -n gpu-monitoring --sort-by='.lastTimestamp'
```

### ログ確認
```bash
# 全コンポーネントのログ
kubectl logs -l app=dcgm-exporter -n gpu-monitoring --tail=100
kubectl logs -l app=prometheus -n gpu-monitoring --tail=100
kubectl logs -l app=gpu-monitor-ui -n gpu-monitoring --tail=100

# リアルタイムログ監視
kubectl logs -f -l app=dcgm-exporter -n gpu-monitoring
```

### ネットワーク確認
```bash
# サービス詳細
kubectl describe svc -n gpu-monitoring

# エンドポイント確認
kubectl get endpoints -n gpu-monitoring

# ポッド間通信テスト
kubectl exec -it <prometheus-pod> -n gpu-monitoring -- wget -qO- http://dcgm-exporter:9400/metrics
```

### GPU環境確認
```bash
# ノードのGPU情報
kubectl describe nodes | grep -A 10 nvidia.com/gpu

# GPU Device Plugin確認
kubectl get pods -n kube-system | grep nvidia

# GPUリソース使用状況
kubectl get nodes -o custom-columns=NAME:.metadata.name,GPU:.status.allocatable."nvidia\.com/gpu"
```

## よくある質問

### Q: 他のGPUメトリクス収集ツールとの併用は可能ですか？
A: はい、可能です。ただし、同じポートを使用しないよう注意してください。

### Q: 複数のKubernetesクラスターを監視できますか？
A: 現在の設定では単一クラスターのみです。複数クラスター対応には、Prometheusの設定を拡張する必要があります。

### Q: アラート機能はありますか？
A: 現在の実装にはアラート機能はありません。Prometheusのアラートルールを追加することで実現可能です。

### Q: データの保持期間は？
A: デフォルトで200時間です。prometheus.yamlの`--storage.tsdb.retention.time`で変更可能です。

### Q: 認証機能はありますか？
A: 現在の実装には認証機能はありません。本番環境では適切な認証・認可の実装を推奨します。