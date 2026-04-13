package main

import (
	"affnet-backend/config"
	"affnet-backend/controllers"
	"affnet-backend/middlewares" // Import folder middleware kamu

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Inisialisasi Database
	config.ConnectDB()

	// 2. Inisialisasi Router Gin
	r := gin.Default()

	// 3. Pasang CORS (Menggunakan library gin-contrib/cors)
	r.Use(middlewares.CORSMiddleware())

	// 4. API Route Grouping
	api := r.Group("/api")
	{
		// --- RUTE PUBLIK (Bisa diakses siapa saja, misal untuk Login) ---
		api.POST("/login", controllers.Login)
		api.POST("/logout", controllers.Logout)

		// --- RUTE TERPROTEKSI (Wajib melewati AuthMiddleware/JWT) ---
		protected := api.Group("/")
		protected.Use(middlewares.AuthMiddleware()) // <--- Satpamnya dipasang di sini
		{
			// ODP Management
			protected.POST("/odp", controllers.CreateOdp)
			protected.GET("/odp", controllers.GetAllOdp)
			protected.PUT("/odp/:id", controllers.UpdateOdp)
			protected.DELETE("/odp/:id", controllers.DeleteOdp)

			// ONU Management
			protected.GET("/onu", controllers.GetAllOnu)
			protected.GET("/onu-sync", controllers.SyncOnuFromZabbix)
			protected.PUT("/onu/:mac", controllers.UpdateOnuDetails)
			protected.DELETE("/onu/:id", controllers.DeleteOnu)

			// Infrastructure & Logs
			protected.GET("/zabbix-infra", controllers.GetZabbixInfra)
			protected.GET("/logs", controllers.GetLogs)
			protected.POST("/logs", controllers.CreateLog)
			protected.PUT("/logs/:id/resolve", controllers.ResolveLog)
			protected.POST("/logs/resolve-by-title", controllers.ResolveLogByTitle)
			protected.DELETE("/logs/:id", controllers.DeleteLog)
			protected.DELETE("/logs/resolved", controllers.ClearResolvedLogs)
		}
	}

	// 5. Jalankan Server
	r.Run("0.0.0.0:8080")
}