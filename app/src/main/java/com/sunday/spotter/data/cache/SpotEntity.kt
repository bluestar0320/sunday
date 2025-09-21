package com.sunday.spotter.data.cache

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "spots")
data class SpotEntity(
    @PrimaryKey val id: String,
    val title: String,
    val latitude: Double,
    val longitude: Double,
    val scene: String,
    val heroBearing: Float,
    val heroTilt: Float,
    val updatedAt: Long
)
