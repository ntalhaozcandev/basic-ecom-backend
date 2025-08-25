# Node.js + MongoDB: Docker & Kubernetes Quickstart

This folder contains production-ready templates to containerize a Node.js backend with MongoDB and publish it to the web.

## 1) Local with Docker Compose

**Prereqs:** Docker Desktop or Docker Engine.

1. Put this folder next to your Node.js app (app should have `package.json` and `npm start`).
2. Adjust `.env` (change `MONGO_PASSWORD` at minimum).
3. Start:  
   ```bash
   docker compose up --build
   ```
4. App: http://localhost:3000  
   Mongo Express (optional): http://localhost:8081

Your app must read the connection string from `MONGO_URL` (or build your own from `MONGO_USERNAME`, `MONGO_PASSWORD`, etc.).

## 2) Kubernetes

**Prereqs:** A cluster (kind/minikube or cloud), `kubectl`, and an ingress controller (e.g., NGINX Ingress).

### Build & Push your image
Replace `ghcr.io/youruser/your-node-app:1.0.0` with your image.
```bash
# From your app root (where Dockerfile is)
docker build -t ghcr.io/youruser/your-node-app:1.0.0 .
docker push ghcr.io/youruser/your-node-app:1.0.0
```

### Apply manifests
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret-mongo.yaml
kubectl apply -f k8s/configmap-app.yaml
kubectl apply -f k8s/mongo-statefulset.yaml
kubectl apply -f k8s/mongo-service.yaml
kubectl apply -f k8s/nodeapp-deployment.yaml
kubectl apply -f k8s/nodeapp-service.yaml
kubectl apply -f k8s/ingress.yaml
```

Once your DNS `api.example.com` points to your ingress controller (or use `nip.io`), you’ll reach the app over HTTP/HTTPS.

### Health checks
The deployment uses `/healthz` for readiness/liveness. Change the path/port to match your app routes.

### Persistent Data
Mongo runs as a StatefulSet with a PersistentVolumeClaim. Adjust `storage: 5Gi` as needed.

## Notes
- Update secrets before deploying: `k8s/secret-mongo.yaml`.
- If your app listens on a different port, update in `Dockerfile`, `docker-compose.yml`, and `k8s/*`.
- To add SSL automatically, install cert-manager and enable the `tls` block in `k8s/ingress.yaml`.
