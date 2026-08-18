# AI-DEVLOG

İlk gün olarak proje akışı kararlaştırıldı. Mermaid uygulaması üzerinden genel akış diagramları çıkartıldı. User Flow - Admin Flow gibi uygulamayı kullanların nasıl bir akıştan geçeceğinin temeli atıldı.

Copilotta kullanacağımız pluginleri ve skilleri tartıştık. Derslerde de öğrendiğimiz üzere caveman ve ponytail pluginlerini token kullanımımızı azaltırken kod kalitesine etkisi olmadığı için tercih ettik ve superpowersın pluginlerini tercih ettik. Onun dışında oluşturduğumuz dosyaları session sonunda veya karar alındıktan sonra yazabilmesi için Skiller oluşturduk.

Ana dosyaları oluşturduk AI araçlarından yardım alarak boş olacak bir şekilde Tech-stack, Plan ve alacağımız kararlar için Decisions dosyalarını oluşturduk. Diyagramlardan aynı şekilde App_flow dosyasını oluşturduk

Uygulamayı yaparken Speckit kütüphanesini kullanmaya karar verdik ve genel olarak Spec-driven ve ATDD kurallarına uygun bir formatta oluşturmaya özen gösterdik. Speclerimizi oluştururken:

```
speckit.constitution -> speckit.specify -> speckit.clarify -> speckit.plan -> speckit.tasks -> speckit.analyze -> speckit.implement
```

şeklinde genel olarak bir yol izledik

speckit.constitution yaparken Agent'ımızın kesinlikle uyması gerektiği kurallara karar kıldık örn: verilen brief dışına çıkmayacağını ve kesinlikle kendi başına karar almayacağına dair kararlar verdik. Spec-Driven olduğunu ATDD prensiblerine uyması gerektiğini de söyledik.

Ekstra olarak projelerimizi yaparken dikeylere bölmeyi tercih ettik bu şekilde birbirimizin paralel olarak çalışması daha mümkün oldu. Bu dikeylerin ne olduğuna karar verirken yine Copilot'tan yardım aldık.

Sonrasında uygulamada kullanacağımız tech stackleri decisionları kararlaştırmak için yine copilottan destek alarak bize çeşitli öneriler sunmasını ve bunların karşılaştırması istedik bu kararları verirken DECISIONS.md dosyasının altında verdiğimiz her kararı ADR-00xx şeklinde numaralandırarak karar verdik. Bu kısımda neyi neden tercih ettiğimiz opsiyonel olanları neden tercih etmediğimizi açıkça belirttik. Tamamen AI kararlarına bırakmadık ve örneğin Better Auth seçerken onun sunmadığı bir opsiyondu ancak onu tercih ettik.

Verdiğimiz tech stack kararlarını genel olarak ihtiyaç doğrultusunda çıkarttık. Sonrasında Copilot'ta daha önceden bahsettiğim speckit kullanarak 3 tane spec çıkarttık '001-auth-rol' - '002-interview' - '003-pre-interview' Bunların her birini kendi aramızda paylaştık ve parelel bir şekilde testlerimizi ve implementasyonlarımızı yaptık.
Bu şekilde ilerlemek hem bizi çok hızlandırdı hem de mergelerimizi birleştirirken confilictlerimizi en aza indirdi

Specleri yazdıktan sonra Copilot'ın kullanması için taskleri hazırladık bu aşamada Paralel çalıştırabileceklerini [P] şeklinde ve her bir task içinde Fazlara böldük bu fazları ise Önceliklere göre etikletledik (P1,P2) şeklinde. Yine her bir fazın implementi yaparken kendi yapacağı doğrulamayı ve hedef görevini belirttik.

Testlerimizi yazarken yine User storyler ve gherkin formatları üzerinden ilerledik her seferinde yazdığı testlere bakarak edge case var mı veya gerçekten bizim istediğimiz bir şekilde bir test yazdı mı kontrol ettik. Olmadığı durumlarda eklediğimiz veya çıkardığımız durumlar oldu.

Testlerimiz 4 farklı şekilde kullandık:

1. Kod testlerini ilgili klasörün .test.tsx formatında yazıldı burada yazılı kodun testi gerçekleşiyordu

2. it.todo şeklinde burada herhangi bir kod testi yok ancak llm hangi taski yapması gerektiğine bakıyordu ve tutarsızlılık olursa buradan kontrol edebiliyordu. implement ettikten sonra da it şekline çeviriyor.

3. Olarak net bir karara bağlanmamış bulgular için bir test o da kod testi ile çalışıyor ancak kırmızı uyarı alınca çalışmaya hatasını düzeltmeye çalışmıyor.

4. End-to-End testler bu kısımda da Playwright kullanarak baştan sona bir ekstra test yaptık bunları User storyler kapsamında yazdırdık

Örnek copilot çıktısı: **backend:** 20 suite / 127 test → 49 geçti, 73 todo, 5 kaldı (hepsi bilinçli: A1–A5 açık bulguları)

Son olarak conflictlerimizi birleştirirken de AI'dan destek aldık ve bunu tamamen AI kararına bırakmadan hangi tercih daha mantıklı olduğuna ve açıklamalı bir şekilde Copilot ile tartışarak karar verdik. Bu aşamada verilen kararlara oluşturlan plana ve tech stack dışına çıkmaması için özellikle dikkat ettik.

## Model Tercihlerimiz

İlk başlarda oluşturduğumuz Planları - Tech Stack dosyasını - Decisionları - App_Flow - User story gibi temel yapıtaşlarını oluşturan dosyalar için Opus 4.6 modelini tercih ettik

Bu kısımlarda olay kritik olduğu için ve bu kurallara uyması gerektiği için başlarda tokenlerimizi baya bir feda ederek sağlam olmasına karar verdik. Aynı zamanda bu kısımda ortak fikirlerimiz olduğunu doğrulamak için ara ara sorular sorduk. Genel olarak her bir plan yaptıktan sonra veya çok fazla 150k gibi context'e ulaşınca summarize ettik ki bu şekilde daha temiz ve anlaşılabilir sonuçlar aldık.

Sonrasında Test oluşturması - Kod implementasyonları - Temel UI/UX tasarımları gibi hem edit yapılması hem de kritik olan yerlerde daha çok sonnet modelini tercih ettik.

Bu kısımlarda sonnet tercih etmemizin sebebi ciddi miktarda maliyet azalmasına karşılık (input 500->200 - output 2500 -> 1000) yine kritik olaylarda düzgün çıktı verebilmesi oldu. Ayrıca bu kısımlarda çok fazla okunacak task ve yazılacak testler olması yine tercih sebebimiz oldu.

Opus ve Sonnet modellerini kullanırken reasoning seçimine de dikkat ettik. taskleri yaparken daha çok dosya okuması gerektiği daha dikkat etmesi gerektiği kısımlarda high yaparken çok gerek olmadığı kısımlarda low'a çektik bu aralıkta kullandık.

Son olarak Haiku modelini ise az kullandık daha çok Edit gerektirmeyen ve bizim genel olarak uygulamamızı etkilemeyen noktalarda örneğin Kütüphanelerin kurulumu veya Github'a atarken commit mesajı oluşturması gibi kısımlarda tercih ettik.

## Kullandığımız MCP'ler

Playwright (Test) - Pen (UI) - Codebase (Memory)
