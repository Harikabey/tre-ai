import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Message } from '@/types/chatbot';

// Convert an image URL to a data URL (handles cross-origin via fetch)
async function toDataURL(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Very small markdown -> HTML: code blocks, inline code, images, bold, italics, headings, lists, links.
// Images are extracted so we can inline them as data URLs.
async function renderMarkdown(md: string): Promise<string> {
  // Extract [FILE:...] blocks (skip - shown as attachment)
  md = md.replace(/\[FILE:([^\]]+)\]\n[\s\S]*?\n\[\/FILE\]/g, (_m, name) => `\n📎 ${name}\n`);

  // Replace images ![alt](url) with placeholders and inline them as data URLs
  const imgPromises: Promise<string>[] = [];
  const imgTokens: string[] = [];
  md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    const token = `@@IMG_${imgTokens.length}@@`;
    imgTokens.push(token);
    imgPromises.push(
      toDataURL(url).then(
        (d) => `<img src="${d || url}" alt="${escapeHtml(alt)}" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;" crossorigin="anonymous"/>`
      )
    );
    return token;
  });
  const imgHtmls = await Promise.all(imgPromises);

  // Code fences
  const codeBlocks: string[] = [];
  md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:#0b1220;color:#d6e2ff;padding:12px;border-radius:8px;overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;border:1px solid #1f2a44;"><div style="font-size:10px;color:#7aa2ff;margin-bottom:6px;">${escapeHtml(lang || 'code')}</div>${escapeHtml(code)}</pre>`
    );
    return `@@CODE_${idx}@@`;
  });

  // Escape remaining HTML
  let html = escapeHtml(md);

  // Headings
  html = html.replace(/^###\s+(.*)$/gm, '<h3 style="margin:10px 0 4px;font-size:14px;">$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2 style="margin:12px 0 6px;font-size:16px;">$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1 style="margin:14px 0 8px;font-size:18px;">$1</h1>');

  // Bold/italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code style="background:#1a2340;color:#a9c7ff;padding:1px 5px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;">$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" style="color:#4aa3ff;text-decoration:underline;">$1</a>');

  // Lists (simple)
  html = html.replace(/^(?:- |\* )(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul style="margin:6px 0 6px 20px;padding:0;">${m}</ul>`);

  // Line breaks (paragraphs)
  html = html.replace(/\n{2,}/g, '</p><p style="margin:6px 0;">');
  html = html.replace(/\n/g, '<br/>');
  html = `<p style="margin:6px 0;">${html}</p>`;

  // Reinject code + images
  codeBlocks.forEach((c, i) => {
    html = html.replace(`@@CODE_${i}@@`, c);
  });
  imgTokens.forEach((t, i) => {
    html = html.replace(t, imgHtmls[i]);
  });

  return html;
}

function formatTime(d: Date): string {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
}

export async function exportChatToPdf(messages: Message[], title = 'Tre Sohbet'): Promise<void> {
  if (!messages.length) throw new Error('empty');

  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed; left:-99999px; top:0; width:800px;
    background:#ffffff; color:#0f172a; padding:32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size:13px; line-height:1.55;
  `;

  const header = document.createElement('div');
  header.innerHTML = `
    <div style="border-bottom:2px solid #0ea5e9;padding-bottom:12px;margin-bottom:18px;">
      <div style="font-size:22px;font-weight:700;color:#0ea5e9;">${escapeHtml(title)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">${new Date().toLocaleString()} • ${messages.length} mesaj</div>
    </div>
  `;
  container.appendChild(header);

  for (const m of messages) {
    const isUser = m.role === 'user';
    const bubble = document.createElement('div');
    bubble.style.cssText = `
      margin:10px 0; padding:12px 14px; border-radius:12px;
      background:${isUser ? '#e0f2fe' : '#f8fafc'};
      border:1px solid ${isUser ? '#bae6fd' : '#e2e8f0'};
      page-break-inside: avoid;
    `;
    const rendered = await renderMarkdown(m.content || '');
    bubble.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:${isUser ? '#0369a1' : '#334155'};margin-bottom:6px;">
        ${isUser ? '👤 Sen' : '🤖 Tre'} <span style="color:#94a3b8;font-weight:400;margin-left:6px;">${formatTime(m.timestamp)}</span>
      </div>
      <div>${rendered}</div>
    `;
    container.appendChild(bubble);
  }

  document.body.appendChild(container);

  // Wait for images to load
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(() => resolve(), 4000);
        })
    )
  );

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const filename = `tre-sohbet-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
