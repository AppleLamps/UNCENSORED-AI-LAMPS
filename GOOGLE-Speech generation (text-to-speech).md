# Speech generation (text-to-speech)

- On this page
- [Single-speaker text-to-speech](https://ai.google.dev/gemini-api/docs/speech-generation#single-speaker)
- [Multi-speaker text-to-speech](https://ai.google.dev/gemini-api/docs/speech-generation#multi-speaker)
- [Controlling speech style with prompts](https://ai.google.dev/gemini-api/docs/speech-generation#controllable)
- [Generating a prompt to convert to audio](https://ai.google.dev/gemini-api/docs/speech-generation#prompt-tts)
- [Voice options](https://ai.google.dev/gemini-api/docs/speech-generation#voices)
- [Supported languages](https://ai.google.dev/gemini-api/docs/speech-generation#languages)
- [Supported models](https://ai.google.dev/gemini-api/docs/speech-generation#supported-models)
- [Limitations](https://ai.google.dev/gemini-api/docs/speech-generation#limitations)
- [What's next](https://ai.google.dev/gemini-api/docs/speech-generation#whats-next)

The Gemini API can transform text input into single speaker or multi-speaker
audio using native text-to-speech (TTS) generation capabilities.
Text-to-speech (TTS) generation is _[controllable](https://ai.google.dev/gemini-api/docs/speech-generation#controllable)_,
meaning you can use natural language to structure interactions and guide the
_style_, _accent_, _pace_, and _tone_ of the audio.

The TTS capability differs from speech generation provided through the
[Live API](https://ai.google.dev/gemini-api/docs/live), which is designed for interactive,
unstructured audio, and multimodal inputs and outputs. While the Live API excels
in dynamic conversational contexts, TTS through the Gemini API
is tailored for scenarios that require exact text recitation with fine-grained
control over style and sound, such as podcast or audiobook generation.

This guide shows you how to generate single-speaker and multi-speaker audio from
text.

## Before you begin

Ensure you use a Gemini 2.5 model variant with native text-to-speech (TTS) capabilities, as listed in the [Supported models](https://ai.google.dev/gemini-api/docs/speech-generation#supported-models) section. For optimal results, consider which model best fits your specific use case.

You may find it useful to [test the Gemini 2.5 TTS models in AI Studio](https://aistudio.google.com/generate-speech) before you start building.

## Single-speaker text-to-speech

To convert text to single-speaker audio, set the response modality to "audio",
and pass a `SpeechConfig` object with `VoiceConfig` set.
You'll need to choose a voice name from the prebuilt [output voices](https://ai.google.dev/gemini-api/docs/speech-generation#voices).

This example saves the output audio from the model in a wave file:

```python
from google import genai
from google.genai import types
import wave

# Set up the wave file to save the output:
def wave_file(filename, pcm, channels=1, rate=24000, sample_width=2):
   with wave.open(filename, "wb") as wf:
      wf.setnchannels(channels)
      wf.setsampwidth(sample_width)
      wf.setframerate(rate)
      wf.writeframes(pcm)

client = genai.Client()

response = client.models.generate_content(
   model="gemini-2.5-flash-preview-tts",
   contents="Say cheerfully: Have a wonderful day!",
   config=types.GenerateContentConfig(
      response_modalities=["AUDIO"],
      speech_config=types.SpeechConfig(
         voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(
               voice_name='Kore',
            )
         )
      ),
   )
)

data = response.candidates[0].content.parts[0].inline_data.data

file_name='out.wav'
wave_file(file_name, data) # Saves the file to current directory
```

```javascript
import {GoogleGenAI} from '@google/genai';
import wav from 'wav';

async function saveWaveFile(
   filename,
   pcmData,
   channels = 1,
   rate = 24000,
   sampleWidth = 2,
) {
   return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
   });
}

async function main() {
   const ai = new GoogleGenAI({});

   const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: 'Say cheerfully: Have a wonderful day!' }] }],
      config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
               voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
               },
            },
      },
   });

   const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
   const audioBuffer = Buffer.from(data, 'base64');

   const fileName = 'out.wav';
   await saveWaveFile(fileName, audioBuffer);
}
await main();
```

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
        "contents": [{
          "parts":[{
            "text": "Say cheerfully: Have a wonderful day!"
          }]
        }],
        "generationConfig": {
          "responseModalities": ["AUDIO"],
          "speechConfig": {
            "voiceConfig": {
              "prebuiltVoiceConfig": {
                "voiceName": "Kore"
              }
            }
          }
        },
        "model": "gemini-2.5-flash-preview-tts",
    }' | jq -r '.candidates[0].content.parts[0].inlineData.data' | \
          base64 --decode >out.pcm
# You may need to install ffmpeg.
ffmpeg -f s16le -ar 24000 -ac 1 -i out.pcm out.wav
```

## Multi-speaker text-to-speech

For multi-speaker audio, you'll need a `MultiSpeakerVoiceConfig` object with
each speaker (up to 2) configured as a `SpeakerVoiceConfig`.
You'll need to define each `speaker` with the same names used in the
[prompt](https://ai.google.dev/gemini-api/docs/speech-generation#controllable):

```python
from google import genai
from google.genai import types
import wave

# Set up the wave file to save the output:
def wave_file(filename, pcm, channels=1, rate=24000, sample_width=2):
   with wave.open(filename, "wb") as wf:
      wf.setnchannels(channels)
      wf.setsampwidth(sample_width)
      wf.setframerate(rate)
      wf.writeframes(pcm)

client = genai.Client()

prompt = """TTS the following conversation between Joe and Jane:
         Joe: How's it going today Jane?
         Jane: Not too bad, how about you?"""

response = client.models.generate_content(
   model="gemini-2.5-flash-preview-tts",
   contents=prompt,
   config=types.GenerateContentConfig(
      response_modalities=["AUDIO"],
      speech_config=types.SpeechConfig(
         multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
            speaker_voice_configs=[
               types.SpeakerVoiceConfig(
                  speaker='Joe',
                  voice_config=types.VoiceConfig(
                     prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name='Kore',
                     )
                  )
               ),
               types.SpeakerVoiceConfig(
                  speaker='Jane',
                  voice_config=types.VoiceConfig(
                     prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name='Puck',
                     )
                  )
               ),
            ]
         )
      )
   )
)

data = response.candidates[0].content.parts[0].inline_data.data

file_name='out.wav'
wave_file(file_name, data) # Saves the file to current directory
```

```javascript
import {GoogleGenAI} from '@google/genai';
import wav from 'wav';

async function saveWaveFile(
   filename,
   pcmData,
   channels = 1,
   rate = 24000,
   sampleWidth = 2,
) {
   return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
   });
}

async function main() {
   const ai = new GoogleGenAI({});

   const prompt = `TTS the following conversation between Joe and Jane:
         Joe: How's it going today Jane?
         Jane: Not too bad, how about you?`;

   const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
               multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                        {
                           speaker: 'Joe',
                           voiceConfig: {
                              prebuiltVoiceConfig: { voiceName: 'Kore' }
                           }
                        },
                        {
                           speaker: 'Jane',
                           voiceConfig: {
                              prebuiltVoiceConfig: { voiceName: 'Puck' }
                           }
                        }
                  ]
               }
            }
      }
   });

   const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
   const audioBuffer = Buffer.from(data, 'base64');

   const fileName = 'out.wav';
   await saveWaveFile(fileName, audioBuffer);
}

await main();
```

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
  "contents": [{
    "parts":[{
      "text": "TTS the following conversation between Joe and Jane:\n                Joe: Hows it going today Jane?\n                Jane: Not too bad, how about you?"
    }]
  }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "multiSpeakerVoiceConfig": {
        "speakerVoiceConfigs": [{
            "speaker": "Joe",
            "voiceConfig": {
              "prebuiltVoiceConfig": {
                "voiceName": "Kore"
              }
            }
          }, {
            "speaker": "Jane",
            "voiceConfig": {
              "prebuiltVoiceConfig": {
                "voiceName": "Puck"
              }
            }
          }]
      }
    }
  },
  "model": "gemini-2.5-flash-preview-tts",
}' | jq -r '.candidates[0].content.parts[0].inlineData.data' | \
    base64 --decode > out.pcm
# You may need to install ffmpeg.
ffmpeg -f s16le -ar 24000 -ac 1 -i out.pcm out.wav
```

## Controlling speech style with prompts

You can control style, tone, accent, and pace using natural language prompts
for both single- and multi-speaker TTS.
For example, in a single-speaker prompt, you can say:

```text
Say in an spooky whisper:
"By the pricking of my thumbs...
Something wicked this way comes"
```

In a multi-speaker prompt, provide the model with each speaker's name and
corresponding transcript. You can also provide guidance for each speaker
individually:

```text
Make Speaker1 sound tired and bored, and Speaker2 sound excited and happy:

Speaker1: So... what's on the agenda today?
Speaker2: You're never going to guess!
```

Try using a [voice option](https://ai.google.dev/gemini-api/docs/speech-generation#voices) that corresponds to the style or emotion you
want to convey, to emphasize it even more. In the previous prompt, for example,
_Enceladus_'s breathiness might emphasize "tired" and "bored", while
_Puck_'s upbeat tone could complement "excited" and "happy".

## Generating a prompt to convert to audio

The TTS models only output audio, but you can use
[other models](https://ai.google.dev/gemini-api/docs/models) to generate a transcript first,
then pass that transcript to the TTS model to read aloud.

```python
from google import genai
from google.genai import types

client = genai.Client()

transcript = client.models.generate_content(
   model="gemini-2.0-flash",
   contents="""Generate a short transcript around 100 words that reads
            like it was clipped from a podcast by excited herpetologists.
            The hosts names are Dr. Anya and Liam.""").text

response = client.models.generate_content(
   model="gemini-2.5-flash-preview-tts",
   contents=transcript,
   config=types.GenerateContentConfig(
      response_modalities=["AUDIO"],
      speech_config=types.SpeechConfig(
         multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
            speaker_voice_configs=[
               types.SpeakerVoiceConfig(
                  speaker='Dr. Anya',
                  voice_config=types.VoiceConfig(
                     prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name='Kore',
                     )
                  )
               ),
               types.SpeakerVoiceConfig(
                  speaker='Liam',
                  voice_config=types.VoiceConfig(
                     prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name='Puck',
                     )
                  )
               ),
            ]
         )
      )
   )
)

# ...Code to stream or save the output
```

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

async function main() {

const transcript = await ai.models.generateContent({
   model: "gemini-2.0-flash",
   contents: "Generate a short transcript around 100 words that reads like it was clipped from a podcast by excited herpetologists. The hosts names are Dr. Anya and Liam.",
   })

const response = await ai.models.generateContent({
   model: "gemini-2.5-flash-preview-tts",
   contents: transcript,
   config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
         multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
                   {
                     speaker: "Dr. Anya",
                     voiceConfig: {
                        prebuiltVoiceConfig: {voiceName: "Kore"},
                     }
                  },
                  {
                     speaker: "Liam",
                     voiceConfig: {
                        prebuiltVoiceConfig: {voiceName: "Puck"},
                    }
                  }
                ]
              }
            }
      }
  });
}
// ..JavaScript code for exporting .wav file for output audio

await main();
```

## Voice options

TTS models support the following 30 voice options in the `voice_name` field:

|     |     |     |
| --- | --- | --- |
| **Zephyr** -- _Bright_ | **Puck** -- _Upbeat_ | **Charon** -- _Informative_ |
| **Kore** -- _Firm_ | **Fenrir** -- _Excitable_ | **Leda** -- _Youthful_ |
| **Orus** -- _Firm_ | **Aoede** -- _Breezy_ | **Callirrhoe** -- _Easy-going_ |
| **Autonoe** -- _Bright_ | **Enceladus** -- _Breathy_ | **Iapetus** -- _Clear_ |
| **Umbriel** -- _Easy-going_ | **Algieba** -- _Smooth_ | **Despina** -- _Smooth_ |
| **Erinome** -- _Clear_ | **Algenib** -- _Gravelly_ | **Rasalgethi** -- _Informative_ |
| **Laomedeia** -- _Upbeat_ | **Achernar** -- _Soft_ | **Alnilam** -- _Firm_ |
| **Schedar** -- _Even_ | **Gacrux** -- _Mature_ | **Pulcherrima** -- _Forward_ |
| **Achird** -- _Friendly_ | **Zubenelgenubi** -- _Casual_ | **Vindemiatrix** -- _Gentle_ |
| **Sadachbia** -- _Lively_ | **Sadaltager** -- _Knowledgeable_ | **Sulafat** -- _Warm_ |

You can hear all the voice options in
[AI Studio](https://aistudio.google.com/generate-speech).

## Supported languages

The TTS models detect the input language automatically. They support the
following 24 languages:

| Language | BCP-47 Code | Language | BCP-47 Code |
| --- | --- | --- | --- |
| Arabic (Egyptian) | `ar-EG` | German (Germany) | `de-DE` |
| English (US) | `en-US` | Spanish (US) | `es-US` |
| French (France) | `fr-FR` | Hindi (India) | `hi-IN` |
| Indonesian (Indonesia) | `id-ID` | Italian (Italy) | `it-IT` |
| Japanese (Japan) | `ja-JP` | Korean (Korea) | `ko-KR` |
| Portuguese (Brazil) | `pt-BR` | Russian (Russia) | `ru-RU` |
| Dutch (Netherlands) | `nl-NL` | Polish (Poland) | `pl-PL` |
| Thai (Thailand) | `th-TH` | Turkish (Turkey) | `tr-TR` |
| Vietnamese (Vietnam) | `vi-VN` | Romanian (Romania) | `ro-RO` |
| Ukrainian (Ukraine) | `uk-UA` | Bengali (Bangladesh) | `bn-BD` |
| English (India) | `en-IN` & `hi-IN` bundle | Marathi (India) | `mr-IN` |
| Tamil (India) | `ta-IN` | Telugu (India) | `te-IN` |

## Supported models

| Model | Single speaker | Multispeaker |
| --- | --- | --- |
| [Gemini 2.5 Flash Preview TTS](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash-preview-tts) | ✔️ | ✔️ |
| [Gemini 2.5 Pro Preview TTS](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-pro-preview-tts) | ✔️ | ✔️ |

## Limitations

- TTS models can only receive text inputs and generate audio outputs.
- A TTS session has a [context window](https://ai.google.dev/gemini-api/docs/long-context) limit of 32k
tokens.
- Review [Languages](https://ai.google.dev/gemini-api/docs/speech-generation#languages) section for language support.
