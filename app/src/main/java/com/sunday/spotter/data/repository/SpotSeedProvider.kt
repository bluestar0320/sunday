package com.sunday.spotter.data.repository

import android.content.Context
import com.sunday.spotter.R
import com.sunday.spotter.data.model.Spot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray

class SpotSeedProvider(private val context: Context) {
    suspend fun loadSeedSpots(): List<Spot> = withContext(Dispatchers.IO) {
        val jsonString = context.resources.openRawResource(R.raw.spots_seed)
            .bufferedReader()
            .use { it.readText() }
        val array = JSONArray(jsonString)
        buildList {
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val heroPose = obj.getJSONObject("heroPose")
                add(
                    Spot(
                        id = obj.getString("id"),
                        title = obj.getString("title"),
                        latitude = obj.getDouble("latitude"),
                        longitude = obj.getDouble("longitude"),
                        scene = obj.getString("scene"),
                        heroBearing = heroPose.getDouble("bearing").toFloat(),
                        heroTilt = heroPose.getDouble("tilt").toFloat()
                    )
                )
            }
        }
    }
}
