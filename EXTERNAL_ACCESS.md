# 外部アクセス設定ガイド

## 🌐 外部からGPU監視モニターにアクセスする方法

このガイドでは、ローカルネットワーク内の他のマシンからGPU監視モニターにアクセスする方法を説明します。

## 🚀 クイックスタート

### 1. 外部アクセス対応デプロイ

```bash
# 外部アクセス対応版をデプロイ
./deploy-external.sh
```

このスクリプトは以下を自動的に設定します：
- NodePort サービス（ポート30080）
- LoadBalancer サービス（MetalLB使用時）
- HostNetwork デプロイメント（オプション）

### 2. アクセス方法の確認

デプロイ完了後、スクリプトが利用可能なアクセス方法を表示します：

```bash
🌐 外部アクセス方法:

1. NodePort経由でのアクセス:
   http://192.168.1.100:30080

2. LoadBalancer経由でのアクセス:
   http://192.168.1.240:8080

3. MetalLB経由でのアクセス:
   http://192.168.1.241:8080
```

## 📋 アクセス方法の詳細

### 方法1: NodePort（推奨）

最も簡単で確実な方法です。

```bash
# ノードのIPアドレスを確認
microk8s kubectl get nodes -o wide

# サービスの確認
microk8s kubectl get svc gpu-monitor-ui -n gpu-monitoring
```

**アクセスURL**: `http://<NODE_IP>:30080`

### 方法2: LoadBalancer（MetalLB）

MetalLBが設定されている場合に使用できます。

```bash
# MetalLBの有効化（IPアドレス範囲を指定）
microk8s enable metallb:192.168.1.240-192.168.1.250

# 外部IPの確認
microk8s kubectl get svc gpu-monitor-ui-metallb -n gpu-monitoring
```

**アクセスURL**: `http://<EXTERNAL_IP>:8080`

### 方法3: HostNetwork

ホストのネットワークを直接使用する方法です。

```bash
# HostNetworkデプロイメントの確認
microk8s kubectl get deployment gpu-monitor-ui-hostnetwork -n gpu-monitoring
```

**アクセスURL**: `http://<NODE_IP>:8080`

### 方法4: Ingress（高度な設定）

Ingressコントローラーを使用する方法です。

```bash
# Ingressアドオンの有効化
microk8s enable ingress

# Ingressの確認
microk8s kubectl get ingress -n gpu-monitoring
```

**アクセスURL**: `http://gpu-monitor.local` または `http://<NODE_IP>`

## 🔧 設定のカスタマイズ

### NodePortのポート変更

[`k8s/web-ui.yaml`](k8s/web-ui.yaml:580) でNodePortを変更できます：

```yaml
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080  # この値を変更（30000-32767の範囲）
```

### MetalLBのIPアドレス範囲変更

```bash
# 現在の設定を確認
microk8s kubectl get configmap config -n metallb-system -o yaml

# 新しい範囲で再設定
microk8s disable metallb
microk8s enable metallb:192.168.1.200-192.168.1.210
```

### ファイアウォール設定

外部アクセスが機能しない場合、ファイアウォールの設定を確認してください：

```bash
# Ubuntu/Debian
sudo ufw allow 30080
sudo ufw allow 8080

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=30080/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

## 🔍 トラブルシューティング

### 問題1: 外部からアクセスできない

**確認事項**:
1. ファイアウォール設定
2. ネットワーク設定
3. サービスの状態

```bash
# サービスの状態確認
microk8s kubectl get svc -n gpu-monitoring

# ポッドの状態確認
microk8s kubectl get pods -n gpu-monitoring

# ノードのIPアドレス確認
microk8s kubectl get nodes -o wide
```

### 問題2: LoadBalancerのExternal-IPがPending

**原因**: MetalLBが正しく設定されていない

**解決方法**:
```bash
# MetalLBの状態確認
microk8s status | grep metallb

# MetalLBの再設定
microk8s disable metallb
microk8s enable metallb:192.168.1.240-192.168.1.250
```

### 問題3: NodePortでアクセスできない

**確認事項**:
1. NodePortの範囲（30000-32767）
2. ポートの競合
3. ネットワークポリシー

```bash
# ポートの使用状況確認
sudo netstat -tlnp | grep :30080

# サービスの詳細確認
microk8s kubectl describe svc gpu-monitor-ui -n gpu-monitoring
```

## 🔒 セキュリティ考慮事項

### 基本認証の追加

本番環境では認証を追加することを推奨します：

```bash
# Basic認証用のSecretを作成
microk8s kubectl create secret generic basic-auth \
  --from-literal=auth=$(echo -n 'admin:password' | base64) \
  -n gpu-monitoring
```

### HTTPS化

TLS証明書を使用してHTTPS化することを推奨します：

```bash
# 自己署名証明書の作成例
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt -subj "/CN=gpu-monitor.local"

# TLS Secretの作成
microk8s kubectl create secret tls gpu-monitor-tls \
  --key tls.key --cert tls.crt -n gpu-monitoring
```

## 📊 監視とメンテナンス

### アクセスログの確認

```bash
# Nginxのアクセスログ確認
microk8s kubectl logs -l app=gpu-monitor-ui -n gpu-monitoring

# リアルタイムログ監視
microk8s kubectl logs -f -l app=gpu-monitor-ui -n gpu-monitoring
```

### パフォーマンス監視

```bash
# リソース使用状況確認
microk8s kubectl top pods -n gpu-monitoring

# サービスの応答時間確認
curl -w "@curl-format.txt" -o /dev/null -s http://<NODE_IP>:30080
```

## 🔗 関連リンク

- [MicroK8s LoadBalancer](https://microk8s.io/docs/addon-metallb)
- [Kubernetes NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#nodeport)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)