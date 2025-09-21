package com.sunday.spotter.domain

fun interface TimeProvider {
    fun now(): Long
}

object SystemTimeProvider : TimeProvider {
    override fun now(): Long = System.currentTimeMillis()
}
