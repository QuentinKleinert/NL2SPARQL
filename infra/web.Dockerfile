FROM nginx:alpine

# UI Static
COPY ui/dist /usr/share/nginx/html

# Nginx Konfiguration
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
