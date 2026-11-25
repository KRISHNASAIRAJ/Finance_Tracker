package com.krishnasairaj.meridian

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  companion object {
    // Set once the React root view has actually been attached. Used to tell a
    // normal cold start apart from a resumed task whose root view is missing.
    private var hasRenderedRoot = false
    private var pausedAt = 0L
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Recovery for the blank screen seen when returning from Android's Recents:
   * sometimes the task is resumed with its React root view detached, leaving
   * only the window background. A force-stop + reopen always fixes it, so
   * rebuild the activity in exactly that case. This runs at most once per
   * background/foreground cycle and never on a normal cold start.
   */
  override fun onPause() {
    super.onPause()
    pausedAt = System.currentTimeMillis()
  }

  override fun onResume() {
    super.onResume()
    val content = window.decorView.findViewById<ViewGroup>(android.R.id.content)
    val hasRoot = content != null && content.childCount > 0
    // The React root attaches asynchronously after onResume on a cold start.
    window.decorView.post {
      val later = window.decorView.findViewById<ViewGroup>(android.R.id.content)
      if (later != null && later.childCount > 0) hasRenderedRoot = true
    }
    if (hasRoot) {
      hasRenderedRoot = true
    } else if (hasRenderedRoot && pausedAt > 0 &&
      System.currentTimeMillis() - pausedAt > 1000 && !isFinishing
    ) {
      hasRenderedRoot = false
      pausedAt = 0
      finish()
      startActivity(Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
      })
    }
    pausedAt = 0
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed()</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
