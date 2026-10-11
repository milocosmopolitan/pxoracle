"""Compile explicitly authored tables into immutable prose-free rules and localized prose."""
import json, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
source = root / 'content/tarot/reading'
def rows(name, n):
    result=[]
    for line in (source/name).read_text().splitlines():
        if not line or line.startswith('#'): continue
        cells=line.split('|')
        assert len(cells)==n, (name,cells[0],len(cells))
        result.append(cells)
    return result
versions=dict(schema=1,engine='reading.2',semantics='semantics.2',rules='rules.2',content='reading.en.1.1')
old=json.loads((root/'content/tarot/en.v1.json').read_text())
topics=['relationships','work','creativity','growth']
roles=['visible','examination','direction','values','conditions','checks','foundation','difficulty','small_action']
strings={};meanings={};rules=[]
intents=['present','crossroads','action']
themes=rows('themes.tsv',7)
for theme,*parts in themes:
    for i,topic in enumerate(topics):
        strings[f'topic.{theme}.{topic}']=parts[i]

position_frames={role:(field,text) for role,field,text in rows('positions.tsv',3)}
assert set(position_frames)==set(roles)
for id,up,rev,lens,*parts in rows('cards.tsv',12):
    assert id in old['cards'] and len(parts)==8
    strings[f'name.{id}']=old['cards'][id]['name']
    for orientation,themes_text,offset in [('upright',up,0),('reversed',rev,4)]:
        key=f'{id}.{orientation}';tags=themes_text.split(',')
        strings[f'{key}.core']=old['cards'][id][orientation]
        for field,text in zip(['resource','difficulty','action','question'],parts[offset:offset+4]):strings[f'{key}.{field}']=text
        for role,(field,frame) in position_frames.items():
            strings[f'{key}.role.{role}']=frame.replace('{0}', strings[f'{key}.{field}'])
        meanings[key]=dict(themes=tags,lens='direct' if orientation=='upright' else lens,coreRef=f'{key}.core',resourceRef=f'{key}.resource',difficultyRef=f'{key}.difficulty',actionRef=f'{key}.action',questionRef=f'{key}.question',topicRefs={t:f'topic.{tags[0]}.{t}' for t in topics},roleRefs={r:f'{key}.role.{r}' for r in roles})
repeat={
'expansion':'Several cards return to opening possibilities. Keep exploration small enough to learn from rather than treating every invitation as a commitment.',
'boundaries':'Limits recur across the cards. Naming what a boundary protects is more useful than simply making it stricter.',
'connection':'Reciprocity recurs across the cards. Check how support and participation actually move between people rather than relying only on shared intentions.',
'solitude':'Private reflection recurs across the cards. Give it a purpose and a point of return so that space does not become indefinite withdrawal.',
'clarity':'Several cards ask for distinctions that can be checked. Separate observation from interpretation before building a larger conclusion.',
'uncertainty':'Incomplete information recurs across the cards. A useful response is to identify one answerable question without pretending all ambiguity can be removed.',
'change':'Revision recurs across the cards. Test what needs to change in manageable pieces rather than requiring a complete reinvention.',
'stability':'Dependable support recurs across the cards. Attention to ordinary maintenance may matter more than adding another ambitious demand.',
'effort':'Directed effort recurs across the cards. Give it a bounded purpose and feedback so persistence does not become a test of endurance.',
'rest':'A pause recurs across the cards. Protect actual recovery rather than postponing a choice while remaining under the same pressure.',
'care':'Care recurs across the cards. Translate concern into one specific form of support that includes the capacity of the person providing it.',
'release':'Letting go recurs across the cards. A deliberate small ending can free attention without denying the value of what came before.'}
for theme,text in repeat.items():
    id=f'repetition.{theme}';strings[f'relation.{id}']=text
    rules.append(dict(id=id,kind='repetition',left=theme,right=theme,priority=40,relationRef=f'relation.{id}',actionRefs={},questionRefs={}))
for id,kind,left,right,priority,relation,action,question in rows('relations.tsv',8):
    strings[f'relation.{id}']=relation
    rules.append(dict(id=id,kind=kind,left=left,right=right,priority=int(priority),relationRef=f'relation.{id}',actionRefs={},questionRefs={}))
# Advice is authored per rule, topic and intent, and Rust selects the reference.
rule_ids={r['id'] for r in rules}
by_id={r['id']:r for r in rules}
for topic in topics:
    seen=set()
    for rule,intent,action,question in rows(f'advice-{topic}.tsv',4):
        assert rule in rule_ids and intent in intents and (rule,intent) not in seen
        assert action.strip() and question.strip() and question.endswith('?')
        seen.add((rule,intent))
        for part,text in [('action',action),('question',question)]:
            ref=f'{part}.{rule}.{topic}.{intent}'
            strings[ref]=text
            by_id[rule][part+'Refs'].setdefault(topic,{})[intent]=ref
    assert seen=={(rule,intent) for rule in rule_ids for intent in intents}, topic
for topic,intent,action,question in rows('fallback.tsv',4):
    assert topic in topics and intent in intents
    for part,text in [('action',action),('question',question)]:
        ref=f'fallback.{topic}.{intent}.{part}'
        assert ref not in strings and text.count('{0}')==1
        strings[ref]=text
assert sum(k.startswith('fallback.') for k in strings)==24
strings['evidence.2']='{0} and {1}: {2}'
strings['evidence.3']='{0}, {1} and {2}: {3}'
flows={
'present':['To understand the present, start with the conditions rather than a prediction. {0}','{0} offers a resource to notice: {1}.','{0} asks you to examine {1}.','{0}: {1}','These rules find no strong shared theme among these cards. Use their sequence as a resource to notice, a difficulty to examine and a direction to consider; they need not tell one hidden story.'],
'crossroads':['This spread examines the basis of a choice; it does not choose an outcome for you. {0}','With {0}, consider the value of {1}.','{0} brings a possible overlooked condition into view: {1}.','{0}: {1}','These rules find no strong shared theme among these cards. Keep the three checks distinct: what you value, what a choice may conceal and what needs checking before commitment.'],
'action':['For a next step, work at the scale of an experiment rather than a promised outcome. {0}','{0} points to a starting resource: {1}.','With {0}, account for {1}.','{0}: {1}','These rules find no strong shared theme among these cards. Begin with the available resource, allow for the difficulty and test a small action without treating the cards as a prediction.']}
for intent,parts in flows.items():
    for part,text in zip(['opening','first','second','third','fallback'],parts):strings[f'flow.{intent}.{part}']=text
assert len(meanings)==156
outputs={'semantics.2.json':dict(versions=versions,meanings=meanings,referenceIds=sorted(strings)), 'rules.2.json':dict(versions=versions,rules=rules),'reading.en.1.1.json':dict(schemaVersion=1,version='reading.en.1.1',locale='en',strings=strings)}
for name,data in outputs.items():
    text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    for path in [source/name,root/'apps/web/public/content/reading'/name]:
        if '--check' in sys.argv:assert path.read_text()==text, f'Stale generated pack: {path}'
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
print(f'{len(meanings)} meanings; {len(rules)} rules; {len(strings)} localized references')
