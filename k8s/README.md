# NOUN HRMS — Kubernetes (K8s) Enterprise Architecture & Staging Setup Guide

This directory contains the production-ready Kubernetes (K8s) manifests for orchestrating the **National Open University of Nigeria (NOUN) Human Resource Management System (HRMS)** microservices.

---

## 🏛️ Architecture Overview

| Manifest File | Component | Description |
|---|---|---|
| `namespace.yaml` | Namespace | Dedicated `noun-hrms` namespace isolating staging/prod workloads |
| `configmap.yaml` | ConfigMap | Environment parameters (`PORT`, `CLIENT_URL`, `NODE_ENV`) |
| `secret.yaml` | Secret | Base64 encoded DB credentials, JWT secret, and Redis URLs |
| `postgres-statefulset.yaml` | StatefulSet | PostgreSQL 15 database with `PersistentVolumeClaim` (PVC 20Gi) |
| `redis-deployment.yaml` | Deployment | Centralized Redis 7 cache & session store for scaling pods |
| `backend-deployment.yaml` | Deployment | Express API backend (3 baseline replicas, rolling updates) |
| `frontend-deployment.yaml` | Deployment | Next.js Frontend dashboard (2 baseline replicas) |
| `hpa.yaml` | HPA | Horizontal Pod Autoscaler scaling API (min: 3, max: 15) @ 70% CPU/Mem |
| `ingress.yaml` | Ingress | NGINX Ingress Controller with Sticky Sessions & WebSocket Support |

---

## 🚀 Local Verification & Staging Guide (Minikube / Kind)

### Prerequisites
1. **Docker Desktop** installed and running.
2. **Minikube** (`brew install minikube`) OR **Kind** (`brew install kind`).
3. **kubectl** (`brew install kubectl`).

---

### Step 1: Start Minikube Cluster with Ingress & Metrics-Server

```bash
# 1. Start Minikube cluster
minikube start --cpus=4 --memory=8192 --driver=docker

# 2. Enable NGINX Ingress addon
minikube addons enable ingress

# 3. Enable Metrics Server (Required for HPA autoscaling verification)
minikube addons enable metrics-server
```

---

### Step 2: Build Container Images directly into Minikube Environment

```bash
# Point your terminal docker CLI to Minikube's Docker daemon
eval $(minikube docker-env)

# Build Backend Image
docker build -t noun-hrms-server:latest ./server

# Build Frontend Image
docker build -t noun-hrms-client:latest ./client
```

---

### Step 3: Deploy All Kubernetes Manifests in Order

```bash
# 1. Create isolated namespace
kubectl apply -f k8s/namespace.yaml

# 2. Apply Configuration & Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 3. Deploy Data & Cache Layers (StatefulSet & Redis)
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml

# Wait for database pod to become ready
kubectl rollout status statefulset/postgres -n noun-hrms --timeout=120s

# 4. Deploy Backend API & Frontend Microservices
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for backend & frontend rollouts
kubectl rollout status deployment/noun-backend-deployment -n noun-hrms --timeout=120s
kubectl rollout status deployment/noun-frontend-deployment -n noun-hrms --timeout=120s

# 5. Apply Autoscaler (HPA) & Ingress Routing Rules
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

---

### Step 4: Staging Verification & Health Checks

#### A. Verify Cluster Status & Pod Health
```bash
kubectl get all -n noun-hrms
```

*Expected Output*:
- `postgres-0` (1/1 Running)
- `redis-deployment-*` (1/1 Running)
- `noun-backend-deployment-*` (3/3 Running)
- `noun-frontend-deployment-*` (2/2 Running)

#### B. Test Health Check Endpoint (Liveness/Readiness Probe)
```bash
# Forward backend service port locally to test
kubectl port-forward svc/noun-backend-service 5055:80 -n noun-hrms
```
In another terminal:
```bash
curl http://localhost:5055/api/health
# Response: {"status":"UP","service":"NOUN-HRMS-API","timestamp":"..."}
```

#### C. Verify Persistent Volume Claim (Data Safety)
```bash
kubectl get pvc -n noun-hrms
# Output: postgres-persistent-storage-postgres-0   Bound ... 20Gi
```

#### D. Verify Horizontal Pod Autoscaler (HPA) Metrics
```bash
kubectl get hpa -n noun-hrms
```
*Expected Output*:
```
NAME                 REFERENCE                             TARGETS   MINPODS   MAXPODS   REPLICAS
noun-backend-hpa     Deployment/noun-backend-deployment    0%/70%    3         15        3
noun-frontend-hpa    Deployment/noun-frontend-deployment   0%/70%    2         10        2
```

#### E. Test Ingress Host Resolution
Add Minikube IP to your `/etc/hosts`:
```bash
echo "$(minikube ip) hrms-staging.noun.edu.ng" | sudo tee -a /etc/hosts
```
Now access:
- **Frontend Dashboard**: `http://hrms-staging.noun.edu.ng/`
- **Backend API**: `http://hrms-staging.noun.edu.ng/api/health`
- **WebSockets / Live Chat**: Sticky sessions preserved via `NOUN_STICKY` cookie.

---

### Step 5: Clean Up Local Staging Cluster

```bash
# Delete all resources in namespace
kubectl delete namespace noun-hrms

# Stop Minikube cluster
minikube stop
```
