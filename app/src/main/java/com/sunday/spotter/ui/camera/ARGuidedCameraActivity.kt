package com.sunday.spotter.ui.camera

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.ar.core.Frame
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.NotYetAvailableException
import com.google.ar.sceneform.ux.ArFragment
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseDetector
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.sunday.spotter.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Activity hosting the AR guidance flow. It connects ARCore camera frames with ML Kit pose
 * detection to provide overlays that help the user align with famous scenes.
 */
class ARGuidedCameraActivity : AppCompatActivity() {

    private lateinit var arFragment: ArFragment
    private lateinit var overlayHint: TextView
    private lateinit var poseDetector: PoseDetector

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ar_camera)
        arFragment = supportFragmentManager.findFragmentById(R.id.ar_fragment) as ArFragment
        overlayHint = findViewById(R.id.hint_overlay)

        val options = PoseDetectorOptions.Builder()
            .setDetectorMode(PoseDetectorOptions.STREAM_MODE)
            .build()
        poseDetector = PoseDetection.getClient(options)

        arFragment.arSceneView.scene.addOnUpdateListener { frameTime ->
            val frame = arFragment.arSceneView.arFrame ?: return@addOnUpdateListener
            lifecycleScope.launch { processFrame(frame) }
        }
    }

    private suspend fun processFrame(frame: Frame) {
        withContext(Dispatchers.IO) {
            try {
                val image = frame.acquireCameraImage()
                val input = InputImage.fromMediaImage(image, 0)
                image.close()
                val pose = detectPose(input) ?: return@withContext
                withContext(Dispatchers.Main) {
                    overlayHint.text = buildPoseHint(pose)
                }
            } catch (exception: CameraNotAvailableException) {
                withContext(Dispatchers.Main) {
                    overlayHint.text = getString(R.string.camera_permission_rationale)
                }
            } catch (_: NotYetAvailableException) {
                // Frame data not ready for CPU image extraction; skip this frame.
            } catch (_: Exception) {
                // Silently ignore transient frame issues to keep latency low.
            }
        }
    }

    private suspend fun detectPose(image: InputImage): Pose? = try {
        poseDetector.process(image).await()
    } catch (_: Exception) {
        null
    }

    private fun buildPoseHint(pose: Pose): String {
        val leftShoulder = pose.getPoseLandmark(PoseLandmark.LEFT_SHOULDER)
        val rightShoulder = pose.getPoseLandmark(PoseLandmark.RIGHT_SHOULDER)
        val midpoint = if (leftShoulder != null && rightShoulder != null) {
            (leftShoulder.position3D.x + rightShoulder.position3D.x) / 2f
        } else {
            0f
        }
        return getString(R.string.tutorial_body) + "\n" + getString(
            R.string.community_call_to_action
        ) + "\nPose center: %.2f".format(midpoint)
    }

    override fun onDestroy() {
        super.onDestroy()
        poseDetector.close()
    }
}
