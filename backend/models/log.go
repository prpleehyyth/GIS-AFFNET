package models

import "time"

type LogSeverity string
type LogSource string

const (
	SeverityCritical LogSeverity = "critical"
	SeverityWarning  LogSeverity = "warning"
	SeverityInfo     LogSeverity = "info"
)

const (
	SourceONU  LogSource = "ONU"
	SourceODP  LogSource = "ODP"
	SourceInfra LogSource = "Infra"
	SourceSystem LogSource = "System"
)

type Log struct {
	ID        uint        `gorm:"primaryKey" json:"id"`
	Severity  LogSeverity `gorm:"not null" json:"severity"`
	Source    LogSource   `gorm:"not null" json:"source"`
	Title     string      `gorm:"not null" json:"title"`
	Message   string      `gorm:"not null" json:"message"`
	Resolved  bool        `gorm:"default:false" json:"resolved"`
	ResolvedAt *time.Time `json:"resolved_at"`
	CreatedAt time.Time   `json:"created_at"`
}