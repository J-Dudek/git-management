package com.gitclient.app

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(SystemBars(), "MerathonSystemBars")
  }

  /** Icônes des barres système selon le thème de l'application, qui peut différer de celui d'Android (voir theme.ts). */
  private inner class SystemBars {
    @JavascriptInterface
    fun setDark(dark: Boolean) = runOnUiThread {
      val bars = WindowCompat.getInsetsController(window, window.decorView)
      bars.isAppearanceLightStatusBars = !dark
      bars.isAppearanceLightNavigationBars = !dark
    }
  }
}
