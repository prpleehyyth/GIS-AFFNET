package middlewares

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Ambil secret key dari env
var jwtKey = []byte(os.Getenv("JWT_SECRET"))

// 1. Middleware untuk CORS
func CORSMiddleware() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:8888"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

// 2. Middleware untuk Validasi Token (JWT)
// Pastikan nama fungsinya "AuthMiddleware" dengan huruf A besar
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Ambil token dari cookie
		tokenString, err := c.Cookie("token")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Silakan login terlebih dahulu"})
			c.Abort()
			return
		}

		// Parse token
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		// Cek validitas
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesi tidak valid atau telah berakhir"})
			c.Abort()
			return
		}

		// Lanjut ke proses berikutnya
		c.Next()
	}
}