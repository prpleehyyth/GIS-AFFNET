package models

import "time"

type Infra struct {
	HostID    string    `gorm:"primaryKey" json:"hostid"`
	Name      string    `json:"name"`
	Lat       string    `json:"lat"`
	Lon       string    `json:"lon"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
