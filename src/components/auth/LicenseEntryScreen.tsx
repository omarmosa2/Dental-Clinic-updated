import React, { useState, useEffect } from 'react'
import { Key, Shield, AlertCircle, CheckCircle, Moon, Sun, Loader2, Info, MessageCircle } from 'lucide-react'
import { useTheme, useThemeClasses } from '../../contexts/ThemeContext'

interface LicenseEntryScreenProps {
  onActivate: (licenseKey: string) => Promise<{ success: boolean; error?: string }>
  isLoading?: boolean
  machineInfo?: {
    hwid: string
    platform: string
    arch: string
  }
}

export default function LicenseEntryScreen({
  onActivate,
  isLoading = false,
  machineInfo
}: LicenseEntryScreenProps) {
  const { isDarkMode, toggleDarkMode } = useTheme()
  const themeClasses = useThemeClasses()

  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [showMachineInfo, setShowMachineInfo] = useState(false)

  // Format license key as user types (XXXXX-XXXXX-XXXXX-XXXXX)
  const formatLicenseKey = (value: string) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase()

    // Split into groups of 5 characters
    const groups = []
    for (let i = 0; i < cleaned.length; i += 5) {
      groups.push(cleaned.slice(i, i + 5))
    }

    // Join with hyphens, limit to 4 groups (20 characters total)
    return groups.slice(0, 4).join('-')
  }

  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value)
    setLicenseKey(formatted)
    setError('') // Clear error when user types
  }

  const validateLicenseFormat = (key: string) => {
    // يقبل كلا التنسيقين: XXXXX-XXXXX-XXXXX-XXXXX أو XXXX-XXXX-XXXX-XXXX
    const regex = /^[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}$/
    return regex.test(key)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!licenseKey.trim()) {
      setError('يرجى إدخال مفتاح الترخيص')
      return
    }

    if (!validateLicenseFormat(licenseKey)) {
      setError('تنسيق مفتاح الترخيص غير صحيح. يجب أن يكون بالشكل: XXXXX-XXXXX-XXXXX-XXXXX')
      return
    }

    setError('')
    setIsValidating(true)

    try {
      const result = await onActivate(licenseKey)

      if (!result.success) {
        setError(result.error || 'فشل في تفعيل الترخيص')
      }
    } catch (error) {
      setError('حدث خطأ أثناء تفعيل الترخيص')
      console.error('License activation error:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const isFormValid = validateLicenseFormat(licenseKey)
  const isSubmitDisabled = isLoading || isValidating || !isFormValid

  return (
    <div className="min-h-screen login-gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-secondary/3"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-accent/5 via-transparent to-primary/3"></div>

      {/* Animated Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-primary/8 to-secondary/4 rounded-full login-floating-orb"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-tl from-secondary/8 to-accent/4 rounded-full login-floating-orb" style={{animationDelay: '2s'}}></div>
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-r from-accent/8 to-primary/4 rounded-full login-floating-orb" style={{animationDelay: '4s'}}></div>

      {/* Theme Toggle Button */}
      <button
        onClick={toggleDarkMode}
        className={`absolute top-6 right-6 p-4 rounded-full ${themeClasses.card} backdrop-blur-md hover:scale-110 hover:rotate-12 transition-all duration-300 z-20 shadow-lg hover:shadow-xl border border-border/30`}
        title={isDarkMode ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع المظلم'}
      >
        {isDarkMode ? (
          <Sun className="w-6 h-6 text-yellow-400 drop-shadow-sm transition-transform duration-300" />
        ) : (
          <Moon className="w-6 h-6 text-primary drop-shadow-sm transition-transform duration-300" />
        )}
      </button>

      {/* Machine Info Toggle */}
      {machineInfo && (
        <button
          onClick={() => setShowMachineInfo(!showMachineInfo)}
          className={`absolute top-6 left-6 p-4 rounded-full ${themeClasses.card} backdrop-blur-md hover:scale-110 transition-all duration-300 z-20 shadow-lg hover:shadow-xl border border-border/30`}
          title="معلومات الجهاز"
        >
          <Info className="w-6 h-6 text-primary drop-shadow-sm transition-transform duration-300" />
        </button>
      )}

      <div className="w-full max-w-lg relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 via-primary/15 to-secondary/20 rounded-full flex items-center justify-center mb-3 shadow-xl backdrop-blur-sm border border-primary/20 hover:scale-105 hover:shadow-2xl transition-all duration-500 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full animate-pulse"></div>
            <Key className="w-8 h-8 text-primary drop-shadow-lg relative z-10" />
          </div>
          <h1 className={`text-2xl font-bold ${themeClasses.textPrimary} arabic-enhanced mb-2 drop-shadow-lg`}>
            تفعيل الترخيص
          </h1>
          <p className={`${themeClasses.textSecondary} arabic-enhanced text-sm font-medium opacity-90 mb-1`}>
            يرجى إدخال مفتاح الترخيص لتفعيل النظام
          </p>
          <p className={`${themeClasses.textSecondary} arabic-enhanced text-xs opacity-75`}>
            التنسيق المطلوب: XXXXX-XXXXX-XXXXX-XXXXX
          </p>
        </div>

        {/* Contact Support Section */}
        <div className="mb-3">
          <div className={`${themeClasses.card} backdrop-blur-xl rounded-xl p-3 border border-border/50 relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 rounded-xl"></div>
            <div className="relative z-10">
              <div className="text-center mb-2">
                <h3 className={`text-sm font-bold ${themeClasses.textPrimary} arabic-enhanced`}>
                  تحتاج مساعدة في التفعيل؟
                </h3>
                <p className={`text-xs ${themeClasses.textSecondary} arabic-enhanced`}>
                  فريق التطوير - AgorraCode
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                {/* WhatsApp Contact */}
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="p-1 bg-green-100 dark:bg-green-900/20 rounded">
                    <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center sm:text-right">
                    <p className={`text-xs font-medium ${themeClasses.textPrimary} arabic-enhanced`}>00963959669628</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const whatsappUrl = `https://api.whatsapp.com/send/?phone=963940046997&text=مرحباً، أحتاج مساعدة في تفعيل ترخيص نظام إدارة العيادة السنية`;

                    // Try multiple methods to open external URL
                    try {
                      // Method 1: Try electronAPI system.openExternal
                      if (window.electronAPI && window.electronAPI.system && window.electronAPI.system.openExternal) {
                        await window.electronAPI.system.openExternal(whatsappUrl);
                        return;
                      }
                    } catch (error) {
                      console.log('Method 1 failed:', error);
                    }

                    try {
                      // Method 2: Try direct shell.openExternal via ipcRenderer
                      if (window.electronAPI) {
                        // @ts-ignore
                        await window.electronAPI.shell?.openExternal?.(whatsappUrl);
                        return;
                      }
                    } catch (error) {
                      console.log('Method 2 failed:', error);
                    }

                    // Method 3: Fallback to window.open
                    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-1 space-x-reverse"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="arabic-enhanced">واتساب</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* License Entry Form */}
        <div className={`${themeClasses.card} backdrop-blur-xl rounded-2xl p-4 login-card-glow hover:scale-[1.02] transition-all duration-500 border border-border/50 relative overflow-hidden`}>
          {/* Card Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 rounded-2xl"></div>
          <div className="relative z-10">
            <form onSubmit={handleSubmit} className="space-y-3" dir="rtl">
              {/* License Key Input */}
              <div className="space-y-2">
                <label htmlFor="licenseKey" className={`block text-sm font-semibold ${themeClasses.textPrimary} arabic-enhanced`}>
                  مفتاح الترخيص
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Key className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    id="licenseKey"
                    value={licenseKey}
                    onChange={handleLicenseKeyChange}
                    disabled={isLoading || isValidating}
                    className={`w-full pr-10 pl-3 py-2 border-2 ${themeClasses.input} rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm backdrop-blur-sm font-mono tracking-wider text-center`}
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    maxLength={23} // 20 characters + 3 hyphens
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {isFormValid && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                </div>
                <p className={`text-xs ${themeClasses.textSecondary} arabic-enhanced`}>
                  أدخل مفتاح الترخيص المكون من 20 حرف وأرقام مقسمة إلى 4 مجموعات
                </p>
              </div>

              {/* Device ID Display */}
              {machineInfo && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-medium ${themeClasses.textSecondary} arabic-enhanced`}>
                      معرف الجهاز (أرسله للمطور)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (machineInfo.hwid) {
                          navigator.clipboard.writeText(machineInfo.hwid)
                          // يمكن إضافة toast notification هنا
                        }
                      }}
                      className={`text-xs px-2 py-1 rounded ${themeClasses.button} hover:opacity-80 transition-opacity`}
                      title="انقر للنسخ"
                    >
                      📋 نسخ
                    </button>
                  </div>
                  <div className={`p-2 ${themeClasses.cardSecondary} rounded border border-border/50 bg-muted/30`}>
                    <div className="flex items-center gap-1 mb-1">
                      <Info className="w-3 h-3 text-primary flex-shrink-0" />
                      <span className="text-xs font-medium text-primary arabic-enhanced">معرف جهازك الفريد</span>
                    </div>
                    <code className="text-xs font-mono text-foreground break-all bg-background/50 p-1 rounded block">
                      {machineInfo.hwid}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1 arabic-enhanced leading-relaxed">
                      💡 أرسل هذا المعرف للمطور عبر الواتساب للحصول على مفتاح ترخيص
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className={`flex items-center space-x-2 space-x-reverse p-2 ${themeClasses.alertError} rounded-lg backdrop-blur-sm`}>
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="text-sm font-medium text-destructive arabic-enhanced">{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className={`w-full py-3 px-4 ${themeClasses.buttonPrimary} rounded-lg font-bold text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 arabic-enhanced`}
              >
                {isLoading || isValidating ? (
                  <div className="flex items-center justify-center space-x-2 space-x-reverse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="arabic-enhanced">جاري التفعيل...</span>
                  </div>
                ) : (
                  <span className="arabic-enhanced">تفعيل الترخيص</span>
                )}
              </button>

              {/* Format Indicator */}
              <div className="text-center">
                <p className={`text-xs ${themeClasses.textSecondary} font-medium arabic-enhanced`}>
                  {licenseKey.length > 0 && (
                    <span className={isFormValid ? 'text-green-500' : 'text-orange-500'}>
                      {licenseKey.length}/23 حرف {isFormValid ? '✓' : ''}
                    </span>
                  )}
                </p>
              </div>
            </form>
          </div>
        </div>



        {/* Machine Info Panel */}
        {showMachineInfo && machineInfo && (
          <div className={`mt-2 ${themeClasses.card} backdrop-blur-xl rounded-lg p-3 border border-border/50 relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-secondary/3 rounded-lg"></div>
            <div className="relative z-10">
              <h3 className={`text-sm font-semibold ${themeClasses.textPrimary} arabic-enhanced mb-2 flex items-center`}>
                <Shield className="w-4 h-4 ml-1" />
                معلومات الجهاز
              </h3>
              <div className="space-y-1 text-xs">
                <div className={`${themeClasses.textSecondary} arabic-enhanced`}>
                  <span className="font-medium">معرف الجهاز:</span>
                  <span className="font-mono ml-1 bg-muted px-1 py-0.5 rounded text-xs">
                    {machineInfo.hwid.substring(0, 8)}...
                  </span>
                </div>
                <div className={`${themeClasses.textSecondary} arabic-enhanced`}>
                  <span className="font-medium">النظام:</span>
                  <span className="ml-1">{machineInfo.platform}</span>
                </div>
                <div className={`${themeClasses.textSecondary} arabic-enhanced`}>
                  <span className="font-medium">المعمارية:</span>
                  <span className="ml-1">{machineInfo.arch}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-2">
          <div className={`inline-flex items-center space-x-2 space-x-reverse px-4 py-2 ${themeClasses.card} backdrop-blur-md rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-border/30`}>
            <Shield className="w-4 h-4 text-primary" />
            <p className={`text-xs ${themeClasses.textSecondary} font-semibold arabic-enhanced`}>
              نظام إدارة العيادة - تفعيل الترخيص
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
