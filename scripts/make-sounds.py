#!/usr/bin/env python3
"""
Полевые звуки матча для /display.

Три главных клипа — не самодельные: это те же файлы, что играют на настоящем
поле FIRST. Их раздаёт Cheesy Arena (Team 254) — альтернативная FMS, на
которой проводят офсезонные соревнования FRC:
https://github.com/Team254/cheesy-arena/tree/main/static/audio
  start.wav   -> старт матча
  warning.wav -> предупреждение о последних 30 секундах (endgame)
  end.wav     -> конец матча
Лицензия Cheesy Arena разрешает использование на офсезонных мероприятиях и
скримиджах — наш случай.

Оригиналы лежат в 11 кГц и местами в 8 бит (это исходные ассеты FMS), поэтому
здесь они приводятся к 44.1 кГц / 16 бит моно и нормализуются в одну
громкость: зал шумный, и клипы должны быть слышны одинаково.

Отсчёт 3-2-1 идёт молча — как на поле FRC, где его ведёт ведущий, а не
звуковой файл.

Запуск: python3 scripts/make-sounds.py
"""
import os, struct, subprocess, wave

SR = 44100
PEAK = 0.92
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds')
FMS = 'https://raw.githubusercontent.com/Team254/cheesy-arena/main/static/audio/%s.wav'
# Имя у нас -> имя в Cheesy Arena.
FIELD_SOUNDS = {'start': 'start', 'endgame': 'warning', 'end': 'end'}


def decode(raw_wav: bytes):
    """Разбирает wav в моно-список сэмплов: у FMS клипы 8- и 16-битные, моно и стерео."""
    import io
    w = wave.open(io.BytesIO(raw_wav))
    n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    raw = w.readframes(n)
    if sw == 2:
        s = list(struct.unpack('<%dh' % (len(raw) // 2), raw))
    elif sw == 1:  # 8-битный wav беззнаковый, середина шкалы — 128
        s = [(b - 128) * 256 for b in raw]
    else:
        raise SystemExit('unsupported sample width: %d' % sw)
    if ch == 2:
        s = [(s[i] + s[i + 1]) // 2 for i in range(0, len(s) - 1, 2)]
    return s, sr


def resample(s, src, dst=SR):
    if src == dst:
        return s
    out, ratio = [], src / dst
    for i in range(int(len(s) * dst / src)):
        x = i * ratio
        j = int(x)
        a = s[j]
        b = s[j + 1] if j + 1 < len(s) else a
        out.append(a + (b - a) * (x - j))
    return out


def write(name, s):
    top = max(abs(v) for v in s) or 1
    k = PEAK * 32767 / top
    data = b''.join(struct.pack('<h', max(-32768, min(32767, int(v * k)))) for v in s)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    print('%s: %.2fs' % (name, len(s) / SR))


for name, remote in FIELD_SOUNDS.items():
    # curl, а не urllib: у системного питона на маке нет своих корневых
    # сертификатов, и загрузка падала на проверке сертификата GitHub.
    raw = subprocess.run(['curl', '-sSfL', FMS % remote], capture_output=True, check=True).stdout
    s, sr = decode(raw)
    write('%s.wav' % name, resample(s, sr))
