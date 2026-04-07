package models

import (
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Username string `gorm:"unique;not null" json:"username"`
	Password string `gorm:"not null" json:"-"` // json:"-" biar password disembunyikan kalau datanya di-Get
	Role     string `gorm:"default:'admin';not null" json:"role"`
}

// Hook GORM: Fungsi ini akan otomatis jalan SEBELUM data user disave ke database
func (u *User) BeforeSave(tx *gorm.DB) (err error) {
	// Cek apakah password ada isinya, lalu enkripsi pakai bcrypt
	if u.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		u.Password = string(hashedPassword)
	}
	return
}