FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
# Jika untuk development (bisa auto-reload saat koding), gunakan baris ini:
CMD ["npm", "run", "dev"]

# Jika untuk produksi (production), hapus CMD di atas dan gunakan 2 baris ini:
# RUN npm run build
# CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]

EXPOSE 3000