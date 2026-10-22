package com.kalpten.kaleme;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private long backPressedTime = 0;
    private boolean isPageLoaded = false;
    private String pendingDocumentJson = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Modern Edge-to-Edge immersion with dark luxury status bar
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(0xFF141926);
        window.setNavigationBarColor(0xFF0D111A);

        webView = new WebView(this);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                isPageLoaded = true;
                deliverPendingDocumentIfAny();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                    uploadMessage = null;
                }
                uploadMessage = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] mimes = {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/msword",
                    "application/pdf",
                    "text/plain",
                    "text/html",
                    "text/markdown",
                    "image/*"
                };
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Belge Seç"), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    if (uploadMessage != null) {
                        uploadMessage.onReceiveValue(null);
                        uploadMessage = null;
                    }
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");

        // Process any incoming intent (e.g. Open With / Şununla Aç from Samsung My Files)
        handleIncomingIntent(getIntent());

        // Load offline embedded application
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action) || Intent.ACTION_EDIT.equals(action)) {
            uri = intent.getData();
            if (uri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
                uri = intent.getClipData().getItemAt(0).getUri();
            }
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
                uri = intent.getClipData().getItemAt(0).getUri();
            }
        }

        if (uri != null) {
            processIncomingDocumentUri(uri);
        }
    }

    private void processIncomingDocumentUri(final Uri uri) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String fileName = "Belge.docx";
                    if ("content".equalsIgnoreCase(uri.getScheme())) {
                        Cursor cursor = getContentResolver().query(uri, null, null, null, null);
                        if (cursor != null) {
                            try {
                                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                                if (nameIndex != -1 && cursor.moveToFirst()) {
                                    String n = cursor.getString(nameIndex);
                                    if (n != null && !n.trim().isEmpty()) {
                                        fileName = n.trim();
                                    }
                                }
                            } catch (Exception ignored) {
                            } finally {
                                cursor.close();
                            }
                        }
                    } else if ("file".equalsIgnoreCase(uri.getScheme())) {
                        String last = uri.getLastPathSegment();
                        if (last != null && !last.trim().isEmpty()) {
                            fileName = last.trim();
                        }
                    }

                    // Read bytes
                    InputStream is = getContentResolver().openInputStream(uri);
                    if (is == null) return;
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = is.read(buffer)) != -1) {
                        baos.write(buffer, 0, len);
                    }
                    is.close();
                    byte[] bytes = baos.toByteArray();
                    if (bytes.length == 0) return;

                    // Automatically mirror to Kalpten Kaleme library
                    try {
                        File mirrorDir = new File(getExternalFilesDir(null), "KalptenKaleme");
                        if (!mirrorDir.exists()) mirrorDir.mkdirs();
                        File mirrorFile = new File(mirrorDir, fileName);
                        FileOutputStream fos = new FileOutputStream(mirrorFile);
                        fos.write(bytes);
                        fos.flush();
                        fos.close();
                    } catch (Exception ignored) {}

                    final String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                    final String safeFileName = fileName;

                    // Prepare pending JSON
                    JSONObject json = new JSONObject();
                    json.put("fileName", safeFileName);
                    json.put("base64", base64);
                    int dot = safeFileName.lastIndexOf('.');
                    String ext = dot >= 0 ? safeFileName.substring(dot + 1).toLowerCase(Locale.ROOT) : "docx";
                    json.put("ext", ext);
                    pendingDocumentJson = json.toString();

                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "\"" + safeFileName + "\" Kalpten Kaleme ile açılıyor...", Toast.LENGTH_SHORT).show();
                            if (isPageLoaded) {
                                deliverPendingDocumentIfAny();
                            }
                        }
                    });
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "Dosya okunamadı: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }

    private void deliverPendingDocumentIfAny() {
        if (pendingDocumentJson == null || webView == null) return;
        final String docJson = pendingDocumentJson;
        pendingDocumentJson = null; // consume once

        String escaped = docJson.replace("\\", "\\\\").replace("'", "\\'");
        String js = "(function(){ try { if (window.__openAndroidDocumentDirect) { window.__openAndroidDocumentDirect('" + escaped + "'); } } catch(e){} })();";
        webView.evaluateJavascript(js, null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (uploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                }
            }
            uploadMessage.onReceiveValue(results);
            uploadMessage = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.__handleAndroidBack ? window.__handleAndroidBack() : false;", new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    if (!"true".equalsIgnoreCase(value)) {
                        if (backPressedTime + 2000 > System.currentTimeMillis()) {
                            finish();
                        } else {
                            Toast.makeText(MainActivity.this, "Çıkmak için tekrar basın", Toast.LENGTH_SHORT).show();
                            backPressedTime = System.currentTimeMillis();
                        }
                    }
                }
            });
        } else {
            super.onBackPressed();
        }
    }

    public class AndroidBridge {
        private final Context context;

        public AndroidBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getPendingDocumentJson() {
            String temp = pendingDocumentJson;
            pendingDocumentJson = null;
            return temp != null ? temp : "";
        }

        @JavascriptInterface
        public void saveBase64File(final String fileName, final String base64Data, final String mimeType) {
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                        // 0. Always mirror to app-scoped storage for instant library display
                        try {
                            File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                            if (!mirrorDir.exists()) mirrorDir.mkdirs();
                            File mirrorFile = new File(mirrorDir, fileName);
                            FileOutputStream mfos = new FileOutputStream(mirrorFile);
                            mfos.write(bytes);
                            mfos.flush();
                            mfos.close();
                        } catch (Exception ignored) {}

                        // 1. Android 10+ (API 29+) MediaStore scoped storage (zero permission requirement)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            try {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOCUMENTS + "/Kalpten Kaleme");

                                Uri collection = MediaStore.Files.getContentUri("external");
                                Uri itemUri = context.getContentResolver().insert(collection, values);
                                if (itemUri != null) {
                                    OutputStream os = context.getContentResolver().openOutputStream(itemUri);
                                    if (os != null) {
                                        os.write(bytes);
                                        os.flush();
                                        os.close();
                                        Toast.makeText(context, "Kütüphaneye ve Belgeler/Kalpten Kaleme klasörüne kaydedildi!", Toast.LENGTH_LONG).show();
                                        return;
                                    }
                                }
                            } catch (Exception exMedia) {
                                // Fallback to legacy file system
                            }
                        }

                        // 2. Legacy direct storage
                        File docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
                        File appDir = new File(docsDir, "Kalpten Kaleme");
                        if (!appDir.exists()) {
                            appDir.mkdirs();
                        }
                        File outFile = new File(appDir, fileName);
                        FileOutputStream fos = new FileOutputStream(outFile);
                        fos.write(bytes);
                        fos.flush();
                        fos.close();

                        MediaScannerConnection.scanFile(context, new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
                        Toast.makeText(context, "Kütüphaneye ve Belgeler/Kalpten Kaleme klasörüne kaydedildi!", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        try {
                            File dlDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                            File outFile = new File(dlDir, fileName);
                            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                            FileOutputStream fos = new FileOutputStream(outFile);
                            fos.write(bytes);
                            fos.flush();
                            fos.close();
                            MediaScannerConnection.scanFile(context, new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
                            Toast.makeText(context, "İndirilenler klasörüne kaydedildi: " + fileName, Toast.LENGTH_LONG).show();
                        } catch (Exception ex) {
                            Toast.makeText(context, "Kayıt hatası: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public String listSavedFilesJson() {
            try {
                List<File> allFiles = new ArrayList<File>();
                Set<String> seenNames = new HashSet<String>();

                // Scan Mirror Directory (Internal / Always accessible)
                File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                if (mirrorDir.exists()) {
                    File[] mFiles = mirrorDir.listFiles();
                    if (mFiles != null) {
                        for (File f : mFiles) {
                            if (f.isFile() && seenNames.add(f.getName().toLowerCase(Locale.ROOT))) {
                                allFiles.add(f);
                            }
                        }
                    }
                }

                // Scan Public Documents / Kalpten Kaleme
                try {
                    File pubDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "Kalpten Kaleme");
                    if (pubDir.exists()) {
                        File[] pFiles = pubDir.listFiles();
                        if (pFiles != null) {
                            for (File f : pFiles) {
                                if (f.isFile() && seenNames.add(f.getName().toLowerCase(Locale.ROOT))) {
                                    allFiles.add(f);
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {}

                if (allFiles.isEmpty()) return "[]";

                Collections.sort(allFiles, new Comparator<File>() {
                    @Override
                    public int compare(File a, File b) {
                        return Long.compare(b.lastModified(), a.lastModified());
                    }
                });

                StringBuilder sb = new StringBuilder("[");
                SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault());
                boolean first = true;
                for (File f : allFiles) {
                    String name = f.getName();
                    int dot = name.lastIndexOf('.');
                    String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "docx";
                    if (!ext.equals("docx") && !ext.equals("doc") && !ext.equals("pdf") && !ext.equals("pptx") && !ext.equals("txt") && !ext.equals("html") && !ext.equals("md")) continue;

                    long kb = Math.max(1, f.length() / 1024);
                    String sizeStr = kb > 1024 ? String.format(Locale.US, "%.1f MB", kb / 1024.0) : (kb + " KB");
                    String dateStr = sdf.format(new Date(f.lastModified()));
                    if (!first) sb.append(",");
                    first = false;
                    String safeName = name.replace("\\", "\\\\").replace("\"", "\\\"");
                    sb.append("{\"name\":\"").append(safeName)
                      .append("\",\"path\":\"").append(safeName)
                      .append("\",\"size\":\"").append(sizeStr)
                      .append("\",\"date\":\"").append(dateStr)
                      .append("\",\"ext\":\"").append(ext).append("\"}");
                }
                sb.append("]");
                return sb.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public String readBase64File(String fileName) {
            try {
                File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                File f = new File(mirrorDir, fileName);
                if (!f.exists()) {
                    File pubDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "Kalpten Kaleme");
                    f = new File(pubDir, fileName);
                }
                if (!f.exists()) return "";
                byte[] data = new byte[(int) f.length()];
                FileInputStream fis = new FileInputStream(f);
                int read = 0;
                while (read < data.length) {
                    int r = fis.read(data, read, data.length - read);
                    if (r <= 0) break;
                    read += r;
                }
                fis.close();
                return Base64.encodeToString(data, Base64.NO_WRAP);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean deleteSavedFile(final String fileName) {
            boolean deleted = false;
            try {
                File mirrorDir = new File(context.getExternalFilesDir(null), "KalptenKaleme");
                File f = new File(mirrorDir, fileName);
                if (f.exists() && f.delete()) deleted = true;
            } catch (Exception ignored) {}
            try {
                File pubDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "Kalpten Kaleme");
                File f = new File(pubDir, fileName);
                if (f.exists() && f.delete()) deleted = true;
            } catch (Exception ignored) {}
            return deleted;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }
    }
}
