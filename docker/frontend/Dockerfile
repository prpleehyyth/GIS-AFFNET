FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
# Jika untuk development (bisa auto-reload saat koding), gunakan baris ini:
CMD ["npm", "run", "dev"]

# Jika untuk sidang skripsi/production, hapus CMD di atas dan gunakan 2 baris ini:
# RUN npm run build
# CMD ["npm", "start"]

EXPOSE 3000