package config

import (
	"log"

	"affnet-backend/models" // <--- Import folder models kita

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	dsn := "host=db user=affnet_user password=affnet_secret dbname=affnet_db port=5432 sslmode=disable TimeZone=Asia/Jakarta"

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Gagal terhubung ke PostgreSQL: ", err)
	}

	// AutoMigrate sekarang merujuk ke struktur yang BENAR di folder models
	err = database.AutoMigrate(&models.Odp{}, &models.Onu{}, &models.User{})
	if err != nil {
		log.Fatal("Gagal melakukan migrasi tabel: ", err)
	}

	DB = database
	log.Println("🚀 Database PostgreSQL Berhasil Terhubung & Tabel ODP, ONU, User Siap!")

	// --- SEEDER USER ADMIN DEFAULT ---
	var count int64
	DB.Model(&models.User{}).Count(&count)
	
	// Kalau tabel user masih kosong (count == 0), buatkan akun admin
	if count == 0 {
		admin := models.User{
			Username: "admin",
			Password: "rara2026", // Akan otomatis di-hash oleh fitur BeforeSave di model
			Role:     "admin",
		}
		
		if err := DB.Create(&admin).Error; err != nil {
			log.Println("⚠️ Gagal menjalankan seeder admin:", err)
		} else {
			log.Println("✅ Seeder berhasil: Akun 'admin' (password: admin123) telah dibuat!")
		}
	}
	
}