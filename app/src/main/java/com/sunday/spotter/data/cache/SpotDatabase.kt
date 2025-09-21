package com.sunday.spotter.data.cache

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [SpotEntity::class],
    version = 1,
    exportSchema = true
)
abstract class SpotDatabase : RoomDatabase() {
    abstract fun spotDao(): SpotDao

    companion object {
        fun build(context: Context): SpotDatabase = Room.databaseBuilder(
            context.applicationContext,
            SpotDatabase::class.java,
            "spots.db"
        ).fallbackToDestructiveMigrationOnDowngrade()
            .build()
    }
}
