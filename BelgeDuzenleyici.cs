using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace BelgeDuzenleyici
{
    public class KalptenKalemeForm : Form
    {
        private WebView2 webView;
        private int serverPort;
        private string appDir;
        private string verifyScreenshotPath;

        [DllImport("user32.dll")]
        private static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

        public KalptenKalemeForm(int port, string baseDir, string verifyShotPath = null)
        {
            this.serverPort = port;
            this.appDir = baseDir;
            this.verifyScreenshotPath = verifyShotPath;

            this.Text = "Kalpten Kaleme";
            this.Size = new Size(1360, 860);
            this.MinimumSize = new Size(820, 560);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(244, 246, 249);

            string iconPath = Path.Combine(appDir, "BelgeDuzenleyici.ico");
            if (!File.Exists(iconPath)) iconPath = Path.Combine(appDir, "kk_lux_app.ico");
            if (File.Exists(iconPath))
            {
                try
                {
                    this.Icon = new Icon(iconPath);
                }
                catch {}
            }

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            this.Controls.Add(webView);

            this.Load += KalptenKalemeForm_Load;
        }

        private void KalptenKalemeForm_Load(object sender, EventArgs e)
        {
            try
            {
                string userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "KalptenKaleme",
                    "NativeStudioData"
                );
                if (!Directory.Exists(userDataFolder))
                {
                    Directory.CreateDirectory(userDataFolder);
                }

                // Ensure clean print preview preferences (suppress browser headers/footers, enable backgrounds)
                try
                {
                    string defaultProfileDir = Path.Combine(userDataFolder, "Default");
                    if (!Directory.Exists(defaultProfileDir)) Directory.CreateDirectory(defaultProfileDir);
                    string prefFile = Path.Combine(defaultProfileDir, "Preferences");
                    string cleanPrintJson = "{\"printing\":{\"print_preview_sticky_settings\":{\"appState\":\"{\\\"headerFooter\\\":false,\\\"isCssBackgroundEnabled\\\":true,\\\"mediaSize\\\":{\\\"name\\\":\\\"ISO_A4\\\"}}\"}}}";
                    if (!File.Exists(prefFile))
                    {
                        File.WriteAllText(prefFile, cleanPrintJson, System.Text.Encoding.UTF8);
                    }
                    else
                    {
                        string currentPref = File.ReadAllText(prefFile, System.Text.Encoding.UTF8);
                        if (!currentPref.Contains("print_preview_sticky_settings"))
                        {
                            File.WriteAllText(prefFile, cleanPrintJson, System.Text.Encoding.UTF8);
                        }
                    }
                }
                catch {}

                var props = new CoreWebView2CreationProperties();
                props.UserDataFolder = userDataFolder;
                props.AdditionalBrowserArguments = "--disable-features=msHub,msEdgeSidebarV2,msEdgeHub,Translate --no-first-run --no-default-browser-check";
                webView.CreationProperties = props;

                webView.CoreWebView2InitializationCompleted += (s, ev) =>
                {
                    if (ev.IsSuccess && webView.CoreWebView2 != null)
                    {
                        try
                        {
                            var settings = webView.CoreWebView2.Settings;
                            settings.IsStatusBarEnabled = false;
                            settings.AreDefaultContextMenusEnabled = false;
                            settings.AreDevToolsEnabled = false;
                            settings.IsPasswordAutosaveEnabled = false;
                            settings.IsGeneralAutofillEnabled = false;

                            // Suppress Edge's "İndirmeler" (Downloads) popup 100%
                            webView.CoreWebView2.DownloadStarting += (ds, dev) =>
                            {
                                try
                                {
                                    string fileName = Path.GetFileName(dev.ResultFilePath);
                                    string syncDir = Program.GetSyncFolder();
                                    if (!string.IsNullOrEmpty(syncDir) && Directory.Exists(syncDir))
                                    {
                                        dev.ResultFilePath = Path.Combine(syncDir, fileName);
                                    }
                                    dev.Handled = true;
                                }
                                catch {}
                            };

                            webView.CoreWebView2.IsDefaultDownloadDialogOpenChanged += (ds, dev) =>
                            {
                                try
                                {
                                    if (webView.CoreWebView2.IsDefaultDownloadDialogOpen)
                                    {
                                        webView.CoreWebView2.CloseDefaultDownloadDialog();
                                    }
                                }
                                catch {}
                            };

                            webView.CoreWebView2.NewWindowRequested += (ns, nev) =>
                            {
                                nev.Handled = true;
                            };
                        }
                        catch {}
                    }
                    else
                    {
                        Program.LaunchFallbackBrowserWindow(serverPort);
                        this.Close();
                    }
                };

                if (!string.IsNullOrEmpty(verifyScreenshotPath))
                {
                    webView.NavigationCompleted += (ns, nev) =>
                    {
                        var t = new System.Windows.Forms.Timer();
                        t.Interval = 1800;
                        t.Tick += async (ts, tev) =>
                        {
                            t.Stop();
                            try
                            {
                                using (var ms = new MemoryStream())
                                {
                                    await webView.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, ms);
                                    ms.Position = 0;
                                    using (var webImg = Image.FromStream(ms))
                                    using (var fullBmp = new Bitmap(this.Width, this.Height))
                                    {
                                        using (var g = Graphics.FromImage(fullBmp))
                                        {
                                            IntPtr hdc = g.GetHdc();
                                            PrintWindow(this.Handle, hdc, 0);
                                            g.ReleaseHdc(hdc);
                                            Point clientPt = this.PointToScreen(Point.Empty);
                                            int offsetX = clientPt.X - this.Left;
                                            int offsetY = clientPt.Y - this.Top;
                                            g.DrawImage(webImg, offsetX, offsetY, webView.Width, webView.Height);
                                        }
                                        fullBmp.Save(verifyScreenshotPath, ImageFormat.Png);
                                    }
                                }
                            }
                            catch {}
                            this.Close();
                        };
                        t.Start();
                    };
                }

                webView.Source = new Uri("http://localhost:" + serverPort + "/index.html");
            }
            catch
            {
                Program.LaunchFallbackBrowserWindow(serverPort);
                this.Close();
            }
        }
    }

    public static class Program
    {
        private const int DefaultPort = 52480;
        private static int activePort = DefaultPort;
        public static string CustomAppDir = null;
        private static string appDir;
        private static string currentFilePath = null;
        private static HttpListener listener = null;
        private static volatile bool isRunning = true;

        private static readonly HashSet<string> SupportedDocumentExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".docx", ".doc", ".txt", ".md", ".html", ".htm", ".pdf", ".pptx", ".ppt", ".json"
        };

        private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".htm", "text/html; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".js", "application/javascript; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".png", "image/png" },
            { ".ico", "image/x-icon" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".svg", "image/svg+xml" },
            { ".pdf", "application/pdf" },
            { ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            { ".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
            { ".ppt", "application/vnd.ms-powerpoint" },
            { ".txt", "text/plain; charset=utf-8" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".ttf", "font/ttf" }
        };

        private class CachedFile
        {
            public byte[] Bytes;
            public DateTime LastWrite;
        }

        private static readonly Dictionary<string, CachedFile> FileCache = new Dictionary<string, CachedFile>(StringComparer.OrdinalIgnoreCase);

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        public static bool IsSupportedDocumentPath(string path)
        {
            if (string.IsNullOrEmpty(path)) return false;
            try
            {
                string ext = Path.GetExtension(path);
                return !string.IsNullOrEmpty(ext) && SupportedDocumentExtensions.Contains(ext);
            }
            catch
            {
                return false;
            }
        }

        [STAThread]
        public static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch {}
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            appDir = !string.IsNullOrEmpty(CustomAppDir) ? CustomAppDir : AppDomain.CurrentDomain.BaseDirectory;
            string targetFileToOpen = null;
            bool headlessServer = false;
            string verifyShotPath = null;

            if (args != null && args.Length > 0)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    string a = args[i];
                    if (string.Equals(a, "--headless-server", StringComparison.OrdinalIgnoreCase))
                    {
                        headlessServer = true;
                    }
                    else if (string.Equals(a, "--capture-verify", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                    {
                        verifyShotPath = args[i + 1];
                        i++;
                    }
                }
                if (!headlessServer && string.IsNullOrEmpty(verifyShotPath))
                {
                    string combined = string.Join(" ", args).Trim('"', '\'');
                    if (File.Exists(combined) && IsSupportedDocumentPath(combined))
                    {
                        targetFileToOpen = Path.GetFullPath(combined);
                    }
                    else
                    {
                        string first = args[0].Trim('"', '\'');
                        if (File.Exists(first) && IsSupportedDocumentPath(first))
                        {
                            targetFileToOpen = Path.GetFullPath(first);
                        }
                    }
                }
            }

            currentFilePath = targetFileToOpen;

            // 1. Check if server is already active on DefaultPort
            if (IsServerActive(DefaultPort))
            {
                activePort = DefaultPort;
                if (!string.IsNullOrEmpty(targetFileToOpen))
                {
                    NotifyRunningInstance(DefaultPort, targetFileToOpen);
                }
                if (!headlessServer)
                {
                    Application.Run(new KalptenKalemeForm(DefaultPort, appDir, verifyShotPath));
                }
                return;
            }

            // 2. Pre-cache static assets
            WarmUpCache();

            // 3. Start Built-in HTTP Server
            bool started = StartHttpServer();
            if (!started)
            {
                return;
            }

            if (!headlessServer)
            {
                // 4. Run 100% Native Windows Desktop Window (WinForms + WebView2)
                Application.Run(new KalptenKalemeForm(activePort, appDir, verifyShotPath));
                isRunning = false;
            }
            else
            {
                while (isRunning)
                {
                    Thread.Sleep(2000);
                }
            }

            try
            {
                if (listener != null)
                {
                    listener.Stop();
                    listener.Close();
                }
            }
            catch {}
        }

        private static void WarmUpCache()
        {
            string[] coreFiles = new string[] { "index.html", "styles.css", "app.js", "word-editor.js", "ppt-editor.js", "pdf-editor.js", "pdf-tools.js", "manifest.json", "favicon.ico", "app.png" };
            foreach (var f in coreFiles)
            {
                try
                {
                    string p = Path.Combine(appDir, f);
                    if (File.Exists(p))
                    {
                        FileCache[f.ToLower()] = new CachedFile { Bytes = File.ReadAllBytes(p), LastWrite = File.GetLastWriteTimeUtc(p) };
                    }
                }
                catch {}
            }
        }

        private static bool StartHttpServer()
        {
            int[] candidatePorts = new int[] { DefaultPort, 52481, 52482, 52483 };
            foreach (int port in candidatePorts)
            {
                try
                {
                    var l = new HttpListener();
                    l.Prefixes.Add("http://localhost:" + port + "/");
                    l.Start();
                    listener = l;
                    activePort = port;

                    Thread serverThread = new Thread(RunServerLoop)
                    {
                        IsBackground = true
                    };
                    serverThread.Start();
                    return true;
                }
                catch
                {
                }
            }
            return false;
        }

        private static bool IsServerActive(int port)
        {
            try
            {
                var ipProps = IPGlobalProperties.GetIPGlobalProperties();
                var listeners = ipProps.GetActiveTcpListeners();
                for (int i = 0; i < listeners.Length; i++)
                {
                    if (listeners[i].Port == port) return true;
                }
            }
            catch {}
            return false;
        }

        private static void NotifyRunningInstance(int port, string filePath)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create("http://localhost:" + port + "/api/open-file");
                req.Method = "POST";
                req.Timeout = 1200;
                byte[] data = Encoding.UTF8.GetBytes(filePath);
                req.ContentType = "text/plain; charset=utf-8";
                req.ContentLength = data.Length;
                using (var stream = req.GetRequestStream())
                {
                    stream.Write(data, 0, data.Length);
                }
                using (var resp = req.GetResponse()) {}
            }
            catch {}
        }

        // ========================================================================
        // Google Drive & OneDrive Cloud Sync Folder Detection
        // ========================================================================
        private static string cachedSyncFolder = null;

        public static string GetSyncFolder()
        {
            if (!string.IsNullOrEmpty(cachedSyncFolder) && Directory.Exists(cachedSyncFolder))
            {
                return cachedSyncFolder;
            }

            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string configFile = Path.Combine(appDir, "config.json");
            if (File.Exists(configFile))
            {
                try
                {
                    string json = File.ReadAllText(configFile, Encoding.UTF8);
                    int idx = json.IndexOf("\"syncFolder\"", StringComparison.OrdinalIgnoreCase);
                    if (idx >= 0)
                    {
                        int colon = json.IndexOf(':', idx);
                        if (colon >= 0)
                        {
                            int q1 = json.IndexOf('"', colon);
                            if (q1 >= 0)
                            {
                                int q2 = json.IndexOf('"', q1 + 1);
                                if (q2 > q1)
                                {
     string folder = json.Substring(q1 + 1, q2 - q1 - 1).Replace("\\\\", "\\");
                                    if (!string.IsNullOrEmpty(folder))
                                    {
                                        bool isForeignUserPath = folder.StartsWith("C:\\Users\\", StringComparison.OrdinalIgnoreCase) &&
                                                                 !folder.StartsWith(userProfile, StringComparison.OrdinalIgnoreCase);
                                        string defaultLocalFallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Kalpten Kaleme");
                                        bool isDefaultLocalFallback = string.Equals(folder.TrimEnd('\\'), defaultLocalFallback.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
                                        string parentDir = Path.GetDirectoryName(folder);
                                        if (!isForeignUserPath && !isDefaultLocalFallback && (Directory.Exists(folder) || (!string.IsNullOrEmpty(parentDir) && Directory.Exists(parentDir))))
                                        {
                                            if (!Directory.Exists(folder))
                                            {
                                                Directory.CreateDirectory(folder);
                                            }
                                            cachedSyncFolder = folder;
                                            return folder;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch {}
            }

            var candidateList = new List<string>
            {
                @"G:\My Drive\Kalpten Kaleme",
                @"G:\Drive'ım\Kalpten Kaleme",
                @"G:\Kalpten Kaleme",
                Path.Combine(userProfile, "Google Drive", "Kalpten Kaleme"),
                Path.Combine(userProfile, "Google Drive'ım", "Kalpten Kaleme"),
                Path.Combine(userProfile, "GoogleDrive", "Kalpten Kaleme")
            };
            string envOneDrive = Environment.GetEnvironmentVariable("OneDrive");
            if (!string.IsNullOrEmpty(envOneDrive)) candidateList.Add(Path.Combine(envOneDrive, "Kalpten Kaleme"));
            string envOneDriveConsumer = Environment.GetEnvironmentVariable("OneDriveConsumer");
            if (!string.IsNullOrEmpty(envOneDriveConsumer)) candidateList.Add(Path.Combine(envOneDriveConsumer, "Kalpten Kaleme"));
            candidateList.Add(Path.Combine(userProfile, "OneDrive", "Kalpten Kaleme"));
            candidateList.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Kalpten Kaleme"));

            foreach (string path in candidateList)
            {
                string parent = Path.GetDirectoryName(path);
                if (Directory.Exists(parent) || path.StartsWith("G:\\", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        if (!Directory.Exists(path))
                        {
                            Directory.CreateDirectory(path);
                        }
                        cachedSyncFolder = path;
                        SaveSyncFolderConfig(path);
                        return path;
                    }
                    catch {}
                }
            }

            string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Kalpten Kaleme");
            try
            {
                if (!Directory.Exists(fallback)) Directory.CreateDirectory(fallback);
            }
            catch {}
            cachedSyncFolder = fallback;
            SaveSyncFolderConfig(fallback);
            return fallback;
        }

        public static void SaveSyncFolderConfig(string path)
        {
            try
            {
                string configFile = Path.Combine(appDir, "config.json");
                string json = string.Format("{{\"syncFolder\":\"{0}\"}}", path.Replace("\\", "\\\\").Replace("\"", "\\\""));
                File.WriteAllText(configFile, json, Encoding.UTF8);
                cachedSyncFolder = path;
            }
            catch {}
        }

        public static string GetCloudProvider(string path)
        {
            if (string.IsNullOrEmpty(path)) return "local";
            string lower = path.ToLower();
            if (lower.StartsWith("g:\\") || lower.Contains("google drive") || lower.Contains("drive'ım") || lower.Contains("googledrive"))
                return "gdrive";
            if (lower.Contains("onedrive"))
                return "onedrive";
            if (lower.Contains("dropbox"))
                return "dropbox";
            return "local";
        }

        public static bool IsPathGoogleDrive(string path)
        {
            return GetCloudProvider(path) == "gdrive";
        }

        public static bool IsPathCloudSync(string path)
        {
            return GetCloudProvider(path) != "local";
        }

        public static void LaunchFallbackBrowserWindow(int port)
        {
            string appUrl = "http://localhost:" + port + "/index.html";
            try { Process.Start(appUrl); } catch {}
        }

        private static void RunServerLoop()
        {
            while (isRunning && listener != null && listener.IsListening)
            {
                try
                {
                    var context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c), context);
                }
                catch
                {
                    if (!isRunning) break;
                }
            }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            string rawUrl = req.Url.AbsolutePath;

            try
            {
                byte[] respBytes = null;

                if (rawUrl == "/api/ping")
                {
                    byte[] pong = Encoding.UTF8.GetBytes("pong");
                    res.ContentType = "text/plain";
                    res.StatusCode = 200;
                    res.OutputStream.Write(pong, 0, pong.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/heartbeat")
                {
                    byte[] ok = Encoding.UTF8.GetBytes("ok");
                    res.ContentType = "text/plain";
                    res.StatusCode = 200;
                    res.OutputStream.Write(ok, 0, ok.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/exit")
                {
                    byte[] bye = Encoding.UTF8.GetBytes("bye");
                    res.ContentType = "text/plain";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bye, 0, bye.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/opened-file-info")
                {
                    string json;
                    if (!string.IsNullOrEmpty(currentFilePath) && File.Exists(currentFilePath) && IsSupportedDocumentPath(currentFilePath))
                    {
                        string fn = Path.GetFileName(currentFilePath);
                        string ext = Path.GetExtension(currentFilePath).TrimStart('.').ToLower();
                        json = string.Format("{{\"hasFile\":true,\"filename\":\"{0}\",\"ext\":\"{1}\"}}", 
                            fn.Replace("\\", "\\\\").Replace("\"", "\\\""), ext);
                    }
                    else
                    {
                        currentFilePath = null;
                        json = "{\"hasFile\":false}";
                    }

                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/opened-file-data")
                {
                    string pathToServe = currentFilePath;
                    currentFilePath = null; // Consume once so subsequent windows start clean!

                    if (!string.IsNullOrEmpty(pathToServe) && File.Exists(pathToServe) && IsSupportedDocumentPath(pathToServe))
                    {
                        byte[] fileBytes = File.ReadAllBytes(pathToServe);
                        string ext = Path.GetExtension(pathToServe);
                        string mime = MimeTypes.ContainsKey(ext) ? MimeTypes[ext] : "application/octet-stream";
                        res.ContentType = mime;
                        res.ContentLength64 = fileBytes.Length;
                        res.StatusCode = 200;
                        res.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                        res.Close();
                        return;
                    }
                    else
                    {
                        res.StatusCode = 404;
                        res.Close();
                        return;
                    }
                }

                if (rawUrl == "/api/open-file" && req.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(req.InputStream, Encoding.UTF8))
                    {
                        string path = reader.ReadToEnd().Trim();
                        if (File.Exists(path) && IsSupportedDocumentPath(path))
                        {
                            currentFilePath = path;
                        }
                    }
                    res.StatusCode = 200;
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/drive-status")
                {
                    string folder = GetSyncFolder();
                    string provider = GetCloudProvider(folder);
                    bool isGDrive = (provider == "gdrive");
                    bool isCloud = (provider != "local");
                    bool exists = Directory.Exists(folder);
                    string json = string.Format("{{\"syncFolder\":\"{0}\",\"isGoogleDrive\":{1},\"isCloudSync\":{2},\"cloudProvider\":\"{3}\",\"exists\":{4}}}",
                        folder.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        isGDrive ? "true" : "false",
                        isCloud ? "true" : "false",
                        provider,
                        exists ? "true" : "false");
                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/save-document" && req.HttpMethod == "POST")
                {
                    string filename = req.QueryString["filename"];
                    if (string.IsNullOrEmpty(filename)) filename = "Yeni Yazı.docx";
                    string fExt = Path.GetExtension(filename).ToLower();
                    if (fExt != ".docx" && fExt != ".pdf" && fExt != ".pptx" && fExt != ".ppt" && fExt != ".json") filename += ".docx";

                    string targetFolder = GetSyncFolder();
                    if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);

                    string savePath = Path.Combine(targetFolder, filename);

                    using (var fs = new FileStream(savePath, FileMode.Create, FileAccess.Write))
                    {
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = req.InputStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            fs.Write(buffer, 0, bytesRead);
                        }
                    }

                    string timeStr = DateTime.Now.ToString("HH:mm");
                    string provider = GetCloudProvider(targetFolder);
                    bool isGDrive = (provider == "gdrive");
                    bool isCloud = (provider != "local");

                    string json = string.Format(
                        "{{\"success\":true,\"path\":\"{0}\",\"filename\":\"{1}\",\"time\":\"{2}\",\"isGoogleDrive\":{3},\"isCloudSync\":{4},\"cloudProvider\":\"{5}\"}}",
                        savePath.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        filename.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        timeStr,
                        isGDrive ? "true" : "false",
                        isCloud ? "true" : "false",
                        provider
                    );
                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/drive-files")
                {
                    string folder = GetSyncFolder();
                    var fileList = new List<string>();

                    if (Directory.Exists(folder))
                    {
                        var dirInfo = new DirectoryInfo(folder);
                        var files = dirInfo.GetFiles("*.*", SearchOption.TopDirectoryOnly);
                        Array.Sort(files, (x, y) => y.LastWriteTimeUtc.CompareTo(x.LastWriteTimeUtc));

                        foreach (var fi in files)
                        {
                            string ext = fi.Extension.ToLower();
                            if (ext == ".docx" || ext == ".doc" || ext == ".txt" || ext == ".pdf" || ext == ".pptx" || ext == ".ppt" || ext == ".json")
                            {
                                string sizeStr;
                                if (fi.Length > 1024 * 1024)
                                    sizeStr = string.Format("{0:0.#} MB", fi.Length / (1024f * 1024f));
                                else
                                    sizeStr = string.Format("{0} KB", Math.Max(1, fi.Length / 1024));

                                string dateStr = fi.LastWriteTime.ToString("dd.MM.yyyy HH:mm");
                                string itemJson = string.Format(
                                    "{{\"name\":\"{0}\",\"path\":\"{1}\",\"size\":\"{2}\",\"date\":\"{3}\",\"ext\":\"{4}\"}}",
                                    fi.Name.Replace("\\", "\\\\").Replace("\"", "\\\""),
                                    fi.FullName.Replace("\\", "\\\\").Replace("\"", "\\\""),
                                    sizeStr,
                                    dateStr,
                                    ext.TrimStart('.')
                                );
                                fileList.Add(itemJson);
                            }
                        }
                    }

                    string json = "[" + string.Join(",", fileList.ToArray()) + "]";
                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/open-sync-folder")
                {
                    string folder = GetSyncFolder();
                    if (Directory.Exists(folder))
                    {
                        try { Process.Start("explorer.exe", "\"" + folder + "\""); } catch {}
                    }
                    respBytes = Encoding.UTF8.GetBytes("{\"success\":true}");
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/select-sync-folder")
                {
                    string selected = null;
                    Thread staThread = new Thread(() =>
                    {
                        try
                        {
                            using (var fbd = new FolderBrowserDialog())
                            {
                                fbd.Description = "Kalpten Kaleme - Google Drive veya Yazı Klasörünü Seçin";
                                fbd.ShowNewFolderButton = true;
                                string cur = GetSyncFolder();
                                if (Directory.Exists(cur)) fbd.SelectedPath = cur;
                                if (fbd.ShowDialog() == DialogResult.OK)
                                {
                                    selected = fbd.SelectedPath;
                                }
                            }
                        }
                        catch {}
                    });
                    staThread.SetApartmentState(ApartmentState.STA);
                    staThread.Start();
                    staThread.Join(60000);

                    if (!string.IsNullOrEmpty(selected) && Directory.Exists(selected))
                    {
                        SaveSyncFolderConfig(selected);
                    }

                    string currentFolder = GetSyncFolder();
                    bool isGDrive = IsPathGoogleDrive(currentFolder);
                    string json = string.Format("{{\"syncFolder\":\"{0}\",\"isGoogleDrive\":{1}}}",
                        currentFolder.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        isGDrive ? "true" : "false");

                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/open-specific-file" && req.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(req.InputStream, Encoding.UTF8))
                    {
                        string path = reader.ReadToEnd().Trim();
                        if (File.Exists(path) && IsSupportedDocumentPath(path))
                        {
                            currentFilePath = path;
                        }
                    }
                    respBytes = Encoding.UTF8.GetBytes("{\"success\":true}");
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                string relPath = rawUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                if (string.IsNullOrEmpty(relPath)) relPath = "index.html";

                string cacheKey = relPath.ToLower();
                byte[] content = null;

                string filePath = Path.Combine(appDir, relPath);
                if (File.Exists(filePath))
                {
                    try
                    {
                        DateTime lastWrite = File.GetLastWriteTimeUtc(filePath);
                        CachedFile cached;
                        if (!FileCache.TryGetValue(cacheKey, out cached) || cached.LastWrite < lastWrite)
                        {
                            cached = new CachedFile { Bytes = File.ReadAllBytes(filePath), LastWrite = lastWrite };
                            FileCache[cacheKey] = cached;
                        }
                        content = cached.Bytes;
                    }
                    catch
                    {
                        if (FileCache.ContainsKey(cacheKey))
                        {
                            content = FileCache[cacheKey].Bytes;
                        }
                    }
                }

                if (content != null)
                {
                    string ext = Path.GetExtension(relPath);
                    string mime = MimeTypes.ContainsKey(ext) ? MimeTypes[ext] : "application/octet-stream";

                    res.ContentType = mime;
                    res.ContentLength64 = content.Length;
                    res.StatusCode = 200;
                    res.OutputStream.Write(content, 0, content.Length);
                    res.Close();
                }
                else
                {
                    res.StatusCode = 404;
                    res.Close();
                }
            }
            catch
            {
                try { res.StatusCode = 500; res.Close(); } catch {}
            }
        }
    }
}
