package controllers

import (
	"net/http"
	"time"
	"os"
	"affnet-backend/config" // Pastikan import ini sesuai dengan nama module go.mod kamu
	"affnet-backend/models" // Pastikan import ini sesuai dengan nama module go.mod kamu

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Kunci rahasia untuk enkripsi JWT (Sebaiknya nanti dipindah ke file .env)
var jwtKey = []byte(os.Getenv("JWT_SECRET"))

// Struktur payload di dalam Token JWT
type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// Struktur untuk menangkap request login dari frontend
type LoginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ==========================================
// FUNGSI LOGIN (Verifikasi DB + Set Cookie)
// ==========================================
func Login(c *gin.Context) {
	var input LoginInput

	// 1. Tangkap inputan JSON dari Next.js
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data username atau password tidak lengkap"})
		return
	}

	// 2. Cari user di Database PostgreSQL berdasarkan username
	var user models.User
	if err := config.DB.Where("username = ?", input.Username).First(&user).Error; err != nil {
		// Jika username tidak ditemukan di tabel
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username tidak ditemukan!"})
		return
	}

	// 3. Cek Password (Mencocokkan password inputan dengan hash bcrypt di DB)
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password))
	if err != nil {
		// Jika password salah
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Password salah!"})
		return
	}

	// 4. Tentukan masa aktif token (24 Jam)
	expirationTime := time.Now().Add(24 * time.Hour)

	// 5. Buat isi data Token (Claims) menggunakan data asli dari database
	claims := &Claims{
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	// 6. Rakit Token dengan algoritma HS256
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 7. Kunci Token dengan secret key
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token JWT"})
		return
	}

	// 8. Kirim Token JWT via HttpOnly Cookie
	// Format: c.SetCookie(name, value, maxAge, path, domain, secure, httpOnly)
	// maxAge 86400 detik = 24 jam
	c.SetCookie("token", tokenString, 86400, "/", "localhost", false, true)

	// 9. Kirim response JSON sukses
	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil",
		"role":    user.Role, // Opsional: kirim role ke frontend buat ngatur menu
	})
}

// ==========================================
// FUNGSI LOGOUT (Hapus Cookie)
// ==========================================
func Logout(c *gin.Context) {
	// Hapus cookie dengan mengatur maxAge menjadi -1 (langsung expired)
	c.SetCookie("token", "", -1, "/", "localhost", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logout berhasil, sesi telah dihapus",
	})
}