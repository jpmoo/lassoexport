package com.lassoexport_scaffold

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class LassoExportCropModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun crop(
      srcPath: String,
      dstPath: String,
      x: Int,
      y: Int,
      width: Int,
      height: Int,
      promise: Promise,
  ) {
    var source: Bitmap? = null
    var cropped: Bitmap? = null
    try {
      source = BitmapFactory.decodeFile(stripFileScheme(srcPath))
          ?: throw IllegalStateException("decodeFile returned null for $srcPath")

      val safeX = x.coerceIn(0, source.width - 1)
      val safeY = y.coerceIn(0, source.height - 1)
      val safeW = width.coerceAtLeast(1).coerceAtMost(source.width - safeX)
      val safeH = height.coerceAtLeast(1).coerceAtMost(source.height - safeY)

      cropped = Bitmap.createBitmap(source, safeX, safeY, safeW, safeH)

      val outFile = File(stripFileScheme(dstPath))
      outFile.parentFile?.mkdirs()
      FileOutputStream(outFile).use { out ->
        cropped.compress(Bitmap.CompressFormat.PNG, 100, out)
      }
      promise.resolve(outFile.absolutePath)
    } catch (e: Throwable) {
      promise.reject("LASSO_EXPORT_CROP_FAILED", e.message, e)
    } finally {
      if (cropped != null && cropped !== source) cropped.recycle()
      source?.recycle()
    }
  }

  private fun stripFileScheme(path: String): String =
      if (path.startsWith("file://")) path.substring("file://".length) else path

  companion object {
    const val NAME = "LassoExportCrop"
  }
}
