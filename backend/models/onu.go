package models

import "time" // Jangan lupa import package time

type Onu struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	MacAddress string    `gorm:"uniqueIndex;not null" json:"mac_address"`
	Customer   string    `json:"customer"`  // Awalnya kosong
	Latitude   string    `json:"latitude"`  // Awalnya kosong
	Longitude  string    `json:"longitude"` // Awalnya kosong
	RxPower    string    `json:"rx_power"`  // Dari Zabbix
	Status     string    `json:"status"`    // Up/Down dari Zabbix
	OdpID      *uint     `json:"odp_id"`
	
	// Tambahan untuk tracking waktu (GORM akan handle ini otomatis)
	CreatedAt  time.Time `json:"created_at"` // Catat kapan ONU pertama kali disedot dari Zabbix
	UpdatedAt  time.Time `json:"updated_at"` // Catat kapan terakhir kali RxPower/Status berubah
}