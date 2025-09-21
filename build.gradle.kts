plugins {
    id("com.android.application") version "8.2.2" apply false
    id("com.android.library") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("com.google.android.libraries.mapsplatform.secrets-gradle-plugin") version "2.0.1" apply false
}

// Centralized versions for reuse inside modules.
ext["composeCompilerVersion"] = "1.5.8"
ext["composeBomVersion"] = "2024.02.00"
