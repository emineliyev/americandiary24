import type { ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary, #333)' }}>{children}</div>
    </div>
  );
}

export function HelpPage() {
  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Help</h1>
        <p className="field-hint">Admin panelin hər bölməsinin nə üçün olduğunun qısa izahı.</p>
      </div>

      <Section title="Dashboard">
        <p>
          Ümumi statistika: cəmi məqalə sayı, dərc olunanlar/qaralamalar/planlaşdırılanlar, kateqoriya və
          istifadəçi sayı, son 7 günün dərc qrafiki və kateqoriyalar üzrə bölgü. Sadəcə icmal üçündür,
          buradan heç nə redaktə olunmur.
        </p>
      </Section>

      <Section title="Articles (Xəbərlər)">
        <p>
          Bütün xəbərlərin yaradıldığı və redaktə olunduğu yerdir. Hər məqalənin statusu ola bilər:
          <strong> Draft</strong> (qaralama, saytda görünmür), <strong>Published</strong> (dərc olunub,
          saytda görünür) və ya <strong>Scheduled</strong> (gələcək tarixə planlaşdırılıb).
        </p>
        <p>
          <strong>Breaking / Exclusive / Editor's Pick</strong> bayraqları məqaləni ana səhifədə xüsusi
          bloklarda göstərir (məs. Editor's Pick işarələnən məqalələr ana səhifənin müvafiq bölməsində çıxır).
        </p>
        <p>
          <strong>Silmək:</strong> bir məqaləni sildikdə o, dərhal yox olmur — "Silinənlər" (Trash) tabına
          keçir. Oradan <strong>Bərpa et</strong> ilə geri qaytarmaq, ya da <strong>Həmişəlik sil</strong> ilə
          tam silmək olar (bu, geri qaytarıla bilməz).
        </p>
        <p>
          <strong>Dublikat et:</strong> mövcud bir məqalənin surətini çıxarır (qaralama kimi) — oxşar
          məqalə yazarkən sıfırdan başlamamaq üçün faydalıdır.
        </p>
      </Section>

      <Section title="Categories">
        <p>
          Xəbər kateqoriyaları (Politics, Business, Sports və s.). "Active" işarəsi söndürüləndə həmin
          kateqoriya naviqasiya menyusundan və saytdan yox olur, amma məlumat silinmir. Sıra nömrəsi
          (order) kateqoriyaların menyuda hansı ardıcıllıqla göründüyünü təyin edir.
        </p>
      </Section>

      <Section title="Tags">
        <p>
          Məqalələrə əlavə edilən açar sözlərdir — axtarış nəticələrini və "əlaqəli xəbərlər" tövsiyələrini
          daha dəqiq etmək üçün istifadə olunur. Bir məqaləyə bir neçə teq əlavə etmək olar.
        </p>
      </Section>

      <Section title="Media">
        <p>
          Saytda yüklənmiş bütün şəkillərin kitabxanasıdır. Bir şəkli bir dəfə yükləyib sonra fərqli
          məqalələrdə/müəllif profillərində təkrar seçmək olar — hər dəfə yenidən yükləmək lazım deyil.
          Şəkilləri qovluqlara (folder) bölüb təşkil etmək mümkündür. Hələ hər hansı yerdə istifadə olunan
          şəkil silinə bilməz — sistem xəbərdarlıq verəcək.
        </p>
      </Section>

      <Section title="Pages">
        <p>
          Saytın sabit səhifələridir: <strong>Privacy Policy, Cookie Policy, Terms of Use, About Us,
          Contact, Advertise With Us</strong>. Bunların sayı sabitdir — yeni səhifə əlavə edilə bilməz,
          mövcud olanlar silinə bilməz (çünki hər birinin sayt üzərində sabit bir linki var, məs.
          <code> /contact.php</code>) — yalnız başlıq və məzmun redaktə oluna bilər.
        </p>
        <p>
          <strong>Active</strong> işarəsi söndürüləndə həmin səhifə saytda 404 (tapılmadı) xətası verir və
          footer-dəki keçidi avtomatik yox olur — məlumat isə silinmir, istənilən vaxt geri aktiv edilə bilər.
        </p>
        <p style={{ color: 'var(--warning, #b06a00)' }}>
          Diqqət: Privacy Policy, Cookie Policy və Terms of Use səhifələri Google AdSense üçün məcburidir —
          bunları deaktiv etməyin.
        </p>
      </Section>

      <Section title="Inquiries">
        <p>
          Saytın Contact səhifəsindəki formadan göndərilən mesajlardır. Oxunmamış mesajlar
          <strong> "NEW"</strong> işarəsi ilə görünür — mesajı açan kimi avtomatik "oxunmuş" sayılır.
          Cavablandırılmış/lazımsız mesajları silmək olar.
        </p>
      </Section>

      <Section title="SEO">
        <p>
          Google axtarış nəticələrində və sosial mediada (Facebook/X) paylaşılanda saytın necə göründüyünü
          idarə edir:
        </p>
        <p>
          <strong>Default Meta Description</strong> — ana səhifə və öz təsviri olmayan səhifələr üçün
          istifadə olunur (məqalələrin və Pages-in öz ayrıca SEO sahələri onsuz da var).
        </p>
        <p>
          <strong>Default Social Share Image</strong> — şəkli olmayan səhifələr (məs. ana səhifə)
          Facebook/X-də paylaşılanda göstəriləcək ehtiyat şəkil. Öz şəkli olan məqalələr bunu istifadə
          etmir, öz şəklini göstərir.
        </p>
        <p>
          <strong>Google Search Console</strong> — saytın Google-a məxsusluğunu təsdiqləmək üçün Search
          Console-dan alınan kodu bura yapışdırın.
        </p>
      </Section>

      <Section title="Users">
        <p>Admin panelə giriş hüququ olan hesablardır. Dörd rol var:</p>
        <p>
          <strong>Administrator</strong> — tam səlahiyyət: istifadəçilər, bütün məqalələr (silmək/həmişəlik
          silmək/bərpa daxil), kateqoriyalar, teqlər, media.
        </p>
        <p>
          <strong>Baş Redaktor (Editor-in-Chief)</strong> — istifadəçilər xaric Administrator ilə eynidir.
        </p>
        <p>
          <strong>Redaktor (Editor)</strong> — istənilən məqaləni yarada/redaktə/dərc edə bilər, amma silə
          bilməz. Kateqoriya/teq/media yalnız baxış üçündür.
        </p>
        <p>
          <strong>Müəllif (Author)</strong> — yalnız öz məqalələrini yarada/redaktə edə bilər, başqasının
          məqaləsinə toxuna bilməz, öz məqaləsini belə silə bilməz.
        </p>
      </Section>

      <Section title="Site Settings">
        <p>
          <strong>Contact Info</strong> — Contact səhifəsində göstərilən e-poçt/telefon/ünvan.
        </p>
        <p>
          <strong>Social Links</strong> — Facebook/X/Instagram/YouTube linkləri. Boş buraxılan sosial
          şəbəkənin ikonu "Follow" blokunda və yuxarı paneldə avtomatik gizlənir.
        </p>
        <p>
          <strong>Analytics &amp; Ads</strong> — Google Analytics ID (ziyarətçi statistikası üçün) və Google
          AdSense Publisher ID (reklamları aktivləşdirmək üçün — daxil edilən kimi <code>ads.txt</code> da
          avtomatik yaranır).
        </p>
      </Section>
    </div>
  );
}
