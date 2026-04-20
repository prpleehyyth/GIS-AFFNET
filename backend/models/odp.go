package models

type Odp struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	Type      string `gorm:"not null;default:'ODP'" json:"type"` // "ODP" atau "ODC"
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
	TotalPort int    `json:"total_port"`

	// Relasi: ODP terhubung ke ODC (nullable — ODC tidak punya parent)
	OdcID *uint `json:"odc_id"`
	Odc   *Odp  `gorm:"foreignKey:OdcID" json:"odc,omitempty"`

	// Relasi ke ONU
	Onus []Onu `gorm:"foreignKey:OdpID" json:"onus"`
}