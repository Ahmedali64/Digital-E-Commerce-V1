FROM nginx:alpine

COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./nginx/conf.d /etc/nginx/conf.d

RUN mkdir -p /var/log/nginx/myapp

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]