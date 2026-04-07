package models

import "time" // Pastikan import time

type Odp struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	Latitude  string    `json:"latitude"`
	Longitude string    `json:"longitude"`
	TotalPort int       `json:"total_port"`
	Onus      []Onu     `json:"onus"` 

	// Tambahan tracker waktu
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}