"""Round 5 (P5.13r): exam-precision-v1, written in this session. Probes: 'valid' — accepted standard English the assessor must not call
an error (named: listed in the round 5 prompt; unnamed: not listed, to test generalisation); 'error' — one real mistake per sentence,
with the full corrected sentences that are acceptable. Generates benchmarks/sources/precision-v1.json."""
import json

def V(id, quote, sentence, cls, named): return {'id': id, 'kind': 'valid', 'quote': quote, 'sentence': sentence, 'class': cls, 'named': named}
def E(id, quote, sentence, cls, accepted): return {'id': id, 'kind': 'error', 'quote': quote, 'sentence': sentence, 'class': cls, 'accepted': accepted}

items = []

# ---------- Task 2 ----------
t = """Traffic congestion has become a daily frustration in many cities, and it wastes both time and money. In my view, it has several connected causes, and it can only be reduced if governments, employers and drivers all play a part.

The most obvious cause is the growing number of private cars. As incomes rise, more families can afford a car, and many people would rather drive than wait for a crowded bus. Another cause is poor planning: in a city whose roads were designed a century ago, even a modest increase in traffic leads to long queues. Commuters also tend to travel at the same time, so the roads are almost empty at noon but full at eight in the morning. In many cities, the council are now trying to spread these peaks by encouraging flexible working hours.

Several measures could solve the problem. First, public transport must become cheaper and more reliable; if a bus ticket is more cheaper than a day of parking, people will leave their cars at home. Second, employers could let staff work from home on some days, which would reduce the number of journeys at peak times. Third, cities could charge drivers who enter the centre during the busiest hours. Whether such a charge is fair depends of how the money is spent. If it is used to improve buses and cycle lanes, most residents will probably accept it.

In conclusion, congestion is caused mainly by car ownership, old road networks and fixed working hours. I would recommend local authorities to combine a congestion charge with better public transport, because neither measure works well on its own."""
items.append({'id': 'p-t2-01', 'task': 't2', 'ref': 'gonative-bench:p24', 'text': t, 'probes': [
    V('whose-inanimate', 'a city whose roads', 'Another cause is poor planning: in a city whose roads were designed a century ago, even a modest increase in traffic leads to long queues.', 'whose for things', False),
    V('collective-plural', 'the council are', 'In many cities, the council are now trying to spread these peaks by encouraging flexible working hours.', 'collective noun with plural verb (British)', False),
    E('double-comparative', 'more cheaper', 'First, public transport must become cheaper and more reliable; if a bus ticket is more cheaper than a day of parking, people will leave their cars at home.', 'double comparative',
      ['First, public transport must become cheaper and more reliable; if a bus ticket is cheaper than a day of parking, people will leave their cars at home.']),
    E('depend-of', 'depends of', 'Whether such a charge is fair depends of how the money is spent.', 'preposition after depend',
      ['Whether such a charge is fair depends on how the money is spent.', 'Whether such a charge is fair depends upon how the money is spent.']),
    V('recommend-to', 'recommend local authorities to combine', 'I would recommend local authorities to combine a congestion charge with better public transport, because neither measure works well on its own.', 'recommend someone to do', True),
]})

t = """Over the past decade, a growing number of universities have started to offer whole degree programmes online. While this way of studying has clear benefits, I believe that its drawbacks are almost as important, so the advantages only slightly outweigh the disadvantages.

The main advantage is flexibility. Students who are working full-time this year can watch lectures in the evening, and those who live far from a university no longer need to move to another city. Online courses are also often less expensive, because universities spend less on buildings and students save on rent and travel. Everyone can study at their own pace, which suits people with young children.

However, there are serious disadvantages. Many online students say that they have nobody to turn to when they are stuck. Without classmates, it is also harder to stay motivated, and some students give up before the end of the first year. Despite of these problems, the number of online students continues to grow. Employers sometimes doubt the value of an online degree, although this attitude is slowly changing. Practical subjects such as nursing or engineering are also hard to teach without laboratories and real patients. Students may also spend many hours on solving technical problems instead of learning.

In conclusion, online degrees make higher education available to people who could not otherwise study, which is a major benefit. Universities should, however, provide regular contact with tutors, so that every student knows where to get support. Students should also make sure that they choose a course which have a good reputation with employers."""
items.append({'id': 'p-t2-02', 'task': 't2', 'ref': 'gonative-bench:p13', 'text': t, 'probes': [
    V('present-continuous-current', 'who are working full-time this year', 'Students who are working full-time this year can watch lectures in the evening, and those who live far from a university no longer need to move to another city.', 'present continuous for a current situation', True),
    V('singular-they', 'Everyone can study at their own pace', 'Everyone can study at their own pace, which suits people with young children.', 'singular they', False),
    V('preposition-at-end', 'nobody to turn to', 'Many online students say that they have nobody to turn to when they are stuck.', 'preposition at the end', False),
    E('despite-of', 'Despite of', 'Despite of these problems, the number of online students continues to grow.', 'despite without of',
      ['Despite these problems, the number of online students continues to grow.', 'In spite of these problems, the number of online students continues to grow.']),
    V('spend-on-doing', 'spend many hours on solving', 'Students may also spend many hours on solving technical problems instead of learning.', 'spend time on doing', True),
    E('relative-agreement', 'which have', 'Students should also make sure that they choose a course which have a good reputation with employers.', 'agreement in a relative clause',
      ['Students should also make sure that they choose a course which has a good reputation with employers.', 'Students should also make sure that they choose a course that has a good reputation with employers.']),
]})

t = """Many governments are worried about rising rates of obesity and diabetes, and some have introduced a high tax on sugary drinks and snacks. I largely agree with this policy, although I believe it should be part of a wider strategy.

The strongest argument for such a tax is that price affects behaviour. When a can of cola costs noticeably more, many people choose water or a cheaper, healthier drink instead. The data from countries that have tried this approach is encouraging: sales of sugary drinks have fallen, and some manufacturers have reduced the sugar in their recipes. The money raised can also be used to fund sports facilities or cooking lessons in schools.

Critics argue that the tax punishes people on low incomes, who spend a larger part of their budget on food. This concern is reasonable, but the health problems caused by sugar are also more common among poorer families, so they would gain the most from healthier habits. Others say that the government should not tell adults what to eat. However, a tax does not ban anything; it simply makes the real cost of unhealthy products more visible. Since the tax was introduced in my country, I notice that my friends buy fewer fizzy drinks.

A tax alone will not solve the problem, though. I suggest that the government also require clear labels on all packaged food, so that shoppers can compare products quickly. In addition, doctors should give patients more informations about a healthy diet.

In conclusion, I agree that a high tax on sugary products is a sensible measure, provided that it is combined with education and better labelling."""
items.append({'id': 'p-t2-03', 'task': 't2', 'ref': 'gonative-bench:p06', 'text': t, 'probes': [
    V('data-singular', 'The data from countries that have tried this approach is encouraging', 'The data from countries that have tried this approach is encouraging: sales of sugary drinks have fallen, and some manufacturers have reduced the sugar in their recipes.', 'data with a singular verb', False),
    E('since-perfect', 'I notice', 'Since the tax was introduced in my country, I notice that my friends buy fewer fizzy drinks.', 'present perfect with since',
      ['Since the tax was introduced in my country, I have noticed that my friends buy fewer fizzy drinks.', 'Since the tax was introduced in my country, I have noticed that my friends are buying fewer fizzy drinks.', 'Since the tax was introduced in my country, I have noticed that my friends have bought fewer fizzy drinks.']),
    V('subjunctive', 'the government also require', 'I suggest that the government also require clear labels on all packaged food, so that shoppers can compare products quickly.', 'mandative subjunctive', False),
    E('uncountable-plural', 'more informations', 'In addition, doctors should give patients more informations about a healthy diet.', 'uncountable noun in the plural',
      ['In addition, doctors should give patients more information about a healthy diet.']),
]})

t = """In many countries, the number of people who live alone has risen sharply. In this essay, I will discuss the advantages and disadvantages of this trend and explain why I think the disadvantages are slightly greater.

Living alone gives people independence. They can decide when to eat, sleep and invite friends, and they do not have to share a kitchen with someone whose habits are different to their own. For young professionals, having their own flat is also a sign of success. In addition, people who live alone often become more confident, because they have to solve everyday problems without help.

On the other hand, living alone can be expensive and lonely. A single person pays the same rent and bills as a couple but has only one income. Loneliness is an even bigger problem, especially for older people. Many of them spend weeks without a real conversation, and doctors say that this affects both mental and physical health. Can you imagine how difficult is it to be ill with nobody to help you? There is also an effect on cities. When more people live alone, more homes are needed, and none of the new flats are cheap.

Governments could reduce these problems. They could support shared housing for students and older people, and they could fund clubs where people who live alone can meet. As soon as a person will retire, they should be offered information about local activities.

In conclusion, living alone brings freedom, but for many people its financial and social costs are higher than its benefits."""
items.append({'id': 'p-t2-04', 'task': 't2', 'ref': 'gonative-bench:p28', 'text': t, 'probes': [
    V('different-to', 'different to their own', 'They can decide when to eat, sleep and invite friends, and they do not have to share a kitchen with someone whose habits are different to their own.', 'different to (British)', False),
    E('embedded-order', 'how difficult is it', 'Can you imagine how difficult is it to be ill with nobody to help you?', 'word order in an embedded question',
      ['Can you imagine how difficult it is to be ill with nobody to help you?']),
    V('none-plural', 'none of the new flats are cheap', 'When more people live alone, more homes are needed, and none of the new flats are cheap.', 'none with a plural verb', False),
    E('time-clause-will', 'will retire', 'As soon as a person will retire, they should be offered information about local activities.', 'present for the future in a time clause',
      ['As soon as a person retires, they should be offered information about local activities.', 'As soon as a person has retired, they should be offered information about local activities.']),
]})

# ---------- General Training Task 1 ----------
t = """Dear Mr Hughes,

I have been a member of the Riverside Running Club for almost four years, and I have always enjoyed the Tuesday and Thursday sessions. I am writing because the new training times are causing problems for many of us.

Since last month, training has started at 5 p.m. instead of 7 p.m. Several of us are working on a big project at the moment and cannot leave the office so early. Last week only six people came, and the coach had to cancel the session. Do you know how many members come on Thursdays now? Could you tell me why were the times changed?

I would like to suggest a better arrangement. We could keep one early session for members who prefer it and move the other one back to 7 p.m. If this is not possible, perhaps the club could ask the members which time suit them best. I would be happy to collect the answers myself.

I look forward to hear from you.

Yours sincerely,
Daniel Ortega"""
items.append({'id': 'p-gt1-01', 'task': 'gt1', 'ref': 'gonative-t1g:gt1-14', 'text': t, 'probes': [
    V('present-continuous-current', 'are working on a big project at the moment', 'Several of us are working on a big project at the moment and cannot leave the office so early.', 'present continuous for a current situation', True),
    V('subject-question', 'how many members come', 'Do you know how many members come on Thursdays now?', 'question about the subject', True),
    E('embedded-order', 'why were the times changed', 'Could you tell me why were the times changed?', 'word order in an embedded question',
      ['Could you tell me why the times were changed?', 'Could you tell me why the times have been changed?']),
    E('subject-question-agreement', 'which time suit', 'If this is not possible, perhaps the club could ask the members which time suit them best.', 'agreement in a question about the subject',
      ['If this is not possible, perhaps the club could ask the members which time suits them best.', 'If this is not possible, perhaps the club could ask the members which time would suit them best.', 'If this is not possible, perhaps the club could ask the members which times suit them best.']),
    E('look-forward-to', 'look forward to hear', 'I look forward to hear from you.', 'to + -ing after look forward',
      ['I look forward to hearing from you.']),
]})

t = """Dear Sir or Madam,

I am writing to report a bag that I left on one of your trains last Friday, 14 March.

I travelled from Leeds to York on the 08:15 service and got off at York at about nine o'clock. I was sitting in the third carriage from the front, and I put the bag on the rack above my seat. I only realised that I had forgotten it when I reached my office. The conductor I spoke to at the station suggested that I write to you.

The bag is a dark green rucksack with a brown leather strap. Inside there were my laptop, a blue notebook and some other equipments for work. The notebook is particularly important to me, as it contains all my notes for an exam next month.

Please let me know when your office will be open next week. Should I come to the station to collect the bag, or your staff will send it to me by post? You can to contact me on 07700 900123 at any time.

Thank you in advance for your help.

Yours faithfully,
Anna Kowalski"""
items.append({'id': 'p-gt1-02', 'task': 'gt1', 'ref': 'gonative-t1g:gt1-05', 'text': t, 'probes': [
    V('preposition-at-end', 'The conductor I spoke to', 'The conductor I spoke to at the station suggested that I write to you.', 'preposition at the end', False),
    E('uncountable-plural', 'other equipments', 'Inside there were my laptop, a blue notebook and some other equipments for work.', 'uncountable noun in the plural',
      ['Inside there were my laptop, a blue notebook and some other equipment for work.', 'Inside there was my laptop, a blue notebook and some other equipment for work.']),
    V('embedded-will', 'when your office will be open', 'Please let me know when your office will be open next week.', 'will in a reported question', True),
    E('alternative-question', 'or your staff will send it', 'Should I come to the station to collect the bag, or your staff will send it to me by post?', 'word order in a direct alternative question',
      ['Should I come to the station to collect the bag, or will your staff send it to me by post?']),
    E('modal-to', 'can to contact', 'You can to contact me on 07700 900123 at any time.', 'base form after a modal verb',
      ['You can contact me on 07700 900123 at any time.']),
]})

t = """Dear Sam,

Sorry I haven't written for ages! I've got some big news: a month ago I started a new job as a sales assistant at a bike shop in the city centre.

I spend most of the day helping customers to choose bikes, and I also do small repairs. What I like most is the team. Everyone is friendly, and the manager always has time for a chat. What I don't like so much is working on Saturdays, because that's when all my friends are free. I'll try and swap some shifts with a colleague next month.

My daily life has changed a lot. I get up at six now, which is much more early than before. I cycle to work, so I'm fitter than I used to be, but in the evenings I'm usually too tired to go out. If you will come to visit in the summer, I can show you the shop. It's closed on Sundays, so we could go cycling together on the weekend.

Write soon and tell me all your news!

Love,
Mia"""
items.append({'id': 'p-gt1-03', 'task': 'gt1', 'ref': 'gonative-t1g:gt1-21', 'text': t, 'probes': [
    V('have-got', "I've got some big news", "I've got some big news: a month ago I started a new job as a sales assistant at a bike shop in the city centre.", 'have got', False),
    V('help-to-infinitive', 'helping customers to choose', 'I spend most of the day helping customers to choose bikes, and I also do small repairs.', 'help someone to do', False),
    V('try-and', "I'll try and swap", "I'll try and swap some shifts with a colleague next month.", 'try and (informal)', False),
    E('comparative-form', 'much more early', 'I get up at six now, which is much more early than before.', 'comparative of early',
      ['I get up at six now, which is much earlier than before.']),
    E('if-will', 'If you will come', 'If you will come to visit in the summer, I can show you the shop.', 'present for the future after if',
      ['If you come to visit in the summer, I can show you the shop.', 'If you come to visit in the summer, I will show you the shop.', "If you come to visit in the summer, I'll show you the shop."]),
    V('on-the-weekend', 'on the weekend', "It's closed on Sundays, so we could go cycling together on the weekend.", 'on the weekend (American)', False),
]})

t = """Dear Priya,

I hope you're well! Can you believe it's been ten years since we left school? I'm organising a reunion for our class, and I'd love your help.

The party will be on Saturday 12 July at the Old Mill restaurant, from seven until late. So far, twenty-three people have said they're coming, including Mr Grant, our old maths teacher!

The problem is that I'm moving house in June, so I won't have much time for the organisation. I also need someone who knows everybody, and you were always the person who everyone talked to. Could you help me with contacting the people I can't find and to choose the music? You could also make a slideshow of our old photos. I'm sure people would spend ages on looking at them.

I know you are very busy since you started your new job, so just tell me what you can manage. Let me know soon!

Best wishes,
Leo"""
items.append({'id': 'p-gt1-04', 'task': 'gt1', 'ref': 'gonative-t1g:gt1-23', 'text': t, 'probes': [
    V('who-object', 'the person who everyone talked to', 'I also need someone who knows everybody, and you were always the person who everyone talked to.', 'who as an object', False),
    E('parallel-after-and', 'and to choose', "Could you help me with contacting the people I can't find and to choose the music?", 'parallel forms after and',
      ["Could you help me with contacting the people I can't find and choosing the music?", "Could you help me contact the people I can't find and choose the music?", "Could you help me to contact the people I can't find and to choose the music?", "Could you help me to contact the people I can't find and choose the music?"]),
    V('spend-on-doing', 'spend ages on looking', "I'm sure people would spend ages on looking at them.", 'spend time on doing', True),
    E('since-perfect', 'you are very busy', 'I know you are very busy since you started your new job, so just tell me what you can manage.', 'present perfect with since',
      ['I know you have been very busy since you started your new job, so just tell me what you can manage.', "I know you've been very busy since you started your new job, so just tell me what you can manage."]),
]})

# ---------- Academic Task 1 ----------
t = """The line graph shows how many people travelled to work by car, bus and bicycle in a European city between 2000 and 2020.

Overall, the car was the most popular way to commute for most of the period, but its use fell, while the number of bus passengers rose steadily. Cycling remained far less common than the other two modes.

In 2000, 420 thousand people drove to work, which was twice as many as the number who took the bus (210 thousand). Car commuting increased with 30 thousand between 2000 and 2005 and then declined, reaching 300 thousand in 2020. In 2005, the most of commuters went by car.

By contrast, bus use grew in every period. Between 2010 and 2020, it grows by 70 thousand, and by 2020 the bus carried more commuters than the car. Compared to 2000, the figure for bus passengers in 2020 was over 50% higher.

The number of cyclists hardly changed. It stayed between 40 and 42 thousand throughout, which was less than a tenth of the number of car commuters in 2000."""
items.append({'id': 'p-t1a-01', 'task': 't1a', 'ref': 'gonative-t1a:t1a-01', 'text': t, 'probes': [
    E('increase-by', 'increased with 30 thousand', 'Car commuting increased with 30 thousand between 2000 and 2005 and then declined, reaching 300 thousand in 2020.', 'by with an amount of change',
      ['Car commuting increased by 30 thousand between 2000 and 2005 and then declined, reaching 300 thousand in 2020.']),
    E('most-of', 'the most of commuters', 'In 2005, the most of commuters went by car.', 'most without the of',
      ['In 2005, most commuters went by car.', 'In 2005, most of the commuters went by car.']),
    E('report-tense', 'it grows by 70 thousand', 'Between 2010 and 2020, it grows by 70 thousand, and by 2020 the bus carried more commuters than the car.', 'past tense for a finished period',
      ['Between 2010 and 2020, it grew by 70 thousand, and by 2020 the bus carried more commuters than the car.']),
    V('compared-to', 'Compared to 2000', 'Compared to 2000, the figure for bus passengers in 2020 was over 50% higher.', 'compared to', False),
    V('less-than-fraction', 'less than a tenth', 'It stayed between 40 and 42 thousand throughout, which was less than a tenth of the number of car commuters in 2000.', 'less than with a fraction', False),
]})

t = """The bar chart compares sales of new petrol, diesel and electric cars in one country between 2015 and 2023.

Overall, sales of petrol and diesel cars fell considerably, whereas electric car sales rose rapidly, so that by 2023 electric cars were not far behind petrol cars.

Petrol cars were the best-selling type throughout. Petrol sales halved over the period, falling from 820 thousand to 410 thousand. They fell in every period shown, with the steepest drop between 2019 and 2021, when they decreased by 160 thousand. Diesel sales dropped even more sharply, and in 2023 only 150 thousands diesel cars were sold.

Electric cars followed the opposite trend. Only 10 thousand were sold in 2015, but since 2019 electric car sales rise every year. In 2021, electric cars accounted for nearly a fifth of all new cars sold. Between 2021 and 2023, the number of electric cars sold rose at 350 thousand, almost double the 2021 figure. By 2023, more electric cars than diesel cars were sold: 350 thousand compared with 150 thousand."""
items.append({'id': 'p-t1a-02', 'task': 't1a', 'ref': 'gonative-t1a:t1a-11', 'text': t, 'probes': [
    V('halved', 'Petrol sales halved', 'Petrol sales halved over the period, falling from 820 thousand to 410 thousand.', 'halve as an intransitive verb', False),
    E('numeral-thousand', '150 thousands', 'Diesel sales dropped even more sharply, and in 2023 only 150 thousands diesel cars were sold.', 'thousand after a number',
      ['Diesel sales dropped even more sharply, and in 2023 only 150 thousand diesel cars were sold.', 'Diesel sales dropped even more sharply, and in 2023 only 150,000 diesel cars were sold.']),
    E('since-perfect', 'electric car sales rise', 'Only 10 thousand were sold in 2015, but since 2019 electric car sales rise every year.', 'present perfect with since',
      ['Only 10 thousand were sold in 2015, but since 2019 electric car sales have risen every year.', 'Only 10 thousand were sold in 2015, but since 2019 electric car sales have been rising every year.']),
    V('approximate-fraction', 'nearly a fifth', 'In 2021, electric cars accounted for nearly a fifth of all new cars sold.', 'approximate fraction that fits the data (18%)', False),
    E('rise-to', 'rose at 350 thousand', 'Between 2021 and 2023, the number of electric cars sold rose at 350 thousand, almost double the 2021 figure.', 'to with the end value',
      ['Between 2021 and 2023, the number of electric cars sold rose to 350 thousand, almost double the 2021 figure.']),
]})

t = """The pie chart shows how an average household in one country divided its spending in 2020.

Overall, housing was by far the largest expense, while leisure accounted for the smallest share of the budget.

Housing took just over a third of household spending, at 34.5%. Food was the second large category at 22%, so these two items together made up more than half of the total. In fact, housing alone accounted for slightly more than food and leisure combined, which together made up 34%.

Transport and leisure together makes up 27.5% of spending. Comparing with food, transport took a smaller share, at 15.5%, and leisure accounted for 12%. The remaining 16% went on other items, which was slightly more than the share for transport. Leisure, at 12%, was the smallest single category, about a third of the share for housing.

In other words, essential costs such as housing, food and transport accounted for almost three quarters of household spending, and only a small part of the budget was left for leisure."""
items.append({'id': 'p-t1a-03', 'task': 't1a', 'ref': 'gonative-t1a:t1a-13', 'text': t, 'probes': [
    V('approximate-fraction', 'just over a third', 'Housing took just over a third of household spending, at 34.5%.', 'approximate fraction that fits the data (34.5%)', False),
    E('superlative', 'second large', 'Food was the second large category at 22%, so these two items together made up more than half of the total.', 'superlative after second',
      ['Food was the second largest category at 22%, so these two items together made up more than half of the total.', 'Food was the second-largest category at 22%, so these two items together made up more than half of the total.']),
    E('plural-agreement', 'makes up', 'Transport and leisure together makes up 27.5% of spending.', 'agreement with two subjects',
      ['Transport and leisure together make up 27.5% of spending.', 'Transport and leisure together made up 27.5% of spending.']),
    E('compared-with', 'Comparing with food', 'Comparing with food, transport took a smaller share, at 15.5%, and leisure accounted for 12%.', 'compared with',
      ['Compared with food, transport took a smaller share, at 15.5%, and leisure accounted for 12%.', 'Compared to food, transport took a smaller share, at 15.5%, and leisure accounted for 12%.']),
    V('approximate-fraction-2', 'almost three quarters', 'In other words, essential costs such as housing, food and transport accounted for almost three quarters of household spending, and only a small part of the budget was left for leisure.', 'approximate fraction that fits the data (72%)', False),
]})

t = """The table shows how many people visited three museums in a city from 2018 to 2020.

Overall, all three museums were less popular in 2020 than in the previous two years, and the art gallery saw the biggest change.

In 2018, the art gallery attracted 150 thousand visitors, more than either of the museums. The art gallery was the most visited of the three in 2018 and 2019, but it has become the least visited in 2020, with only 50 thousand.

The science museum grew in 2019, when it attracted 15 thousand visitors more then in 2018. However, its visitor numbers more than halved in 2020, falling from 135 thousand to 60 thousand.

The history museum was the most stable of the three. It lost less visitors than the others in 2020, falling from 95 thousand to 70 thousand. None of the museums were as popular in 2020 as they had been in 2019."""
items.append({'id': 'p-t1a-04', 'task': 't1a', 'ref': 'gonative-t1a:t1a-19', 'text': t, 'probes': [
    E('present-perfect-past-time', 'has become', 'The art gallery was the most visited of the three in 2018 and 2019, but it has become the least visited in 2020, with only 50 thousand.', 'past simple with a past time',
      ['The art gallery was the most visited of the three in 2018 and 2019, but it became the least visited in 2020, with only 50 thousand.', 'The art gallery was the most visited of the three in 2018 and 2019, but it was the least visited in 2020, with only 50 thousand.']),
    E('than-then', 'more then', 'The science museum grew in 2019, when it attracted 15 thousand visitors more then in 2018.', 'than in a comparison',
      ['The science museum grew in 2019, when it attracted 15 thousand visitors more than in 2018.', 'The science museum grew in 2019, when it attracted 15 thousand more visitors than in 2018.']),
    V('more-than-halved', 'more than halved', 'However, its visitor numbers more than halved in 2020, falling from 135 thousand to 60 thousand.', 'more than halved (fits the data)', False),
    E('fewer-countable', 'less visitors', 'It lost less visitors than the others in 2020, falling from 95 thousand to 70 thousand.', 'fewer with countable nouns',
      ['It lost fewer visitors than the others in 2020, falling from 95 thousand to 70 thousand.']),
    V('none-plural', 'None of the museums were', 'None of the museums were as popular in 2020 as they had been in 2019.', 'none with a plural verb', False),
]})

out = {'id': 'exam-precision-v1', 'about': 'Round 5 (owner tests 06-09): probes of accepted variants and real mistakes; texts written in the session, not taken from the owner tests.', 'items': items}
json.dump(out, open('../sources/precision-v1.json', 'w'), ensure_ascii=False, indent=1)
print(len(items), 'items', sum(len(i['probes']) for i in items), 'probes',
      sum(p['kind'] == 'valid' for i in items for p in i['probes']), 'valid',
      sum(p['kind'] == 'valid' and p['named'] for i in items for p in i['probes']), 'named')
