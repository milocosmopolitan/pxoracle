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
versions=dict(schema=1,engine='reading.1',semantics='semantics.1',rules='rules.1',content='reading.en.1')
old=json.loads((root/'content/tarot/en.v1.json').read_text())
topics=['relationships','work','creativity','growth']
roles=['visible','examination','direction','values','conditions','checks','foundation','difficulty','small_action']
strings={};meanings={};rules=[]
scopes=['Within a relationship','In your work or career','For a creative project','In your personal growth']
themes=rows('themes.tsv',7)
for theme,*parts in themes:
    for i,topic in enumerate(topics):
        strings[f'topic.{theme}.{topic}']=parts[i]
        strings[f'action.repeat.{theme}.{topic}']=scopes[i]+', '+parts[4]
        strings[f'question.repeat.{theme}.{topic}']=scopes[i]+', '+parts[5][0].lower()+parts[5][1:]
for theme,*parts in rows('roles.tsv',10):
    for role,text in zip(roles,parts):strings[f'role.{theme}.{role}']=text
for id,up,rev,lens,*parts in rows('cards.tsv',12):
    assert id in old['cards'] and len(parts)==8
    strings[f'name.{id}']=old['cards'][id]['name']
    for orientation,themes_text,offset in [('upright',up,0),('reversed',rev,4)]:
        key=f'{id}.{orientation}';tags=themes_text.split(',')
        strings[f'{key}.core']=old['cards'][id][orientation]
        for field,text in zip(['resource','difficulty','action','question'],parts[offset:offset+4]):strings[f'{key}.{field}']=text
        meanings[key]=dict(themes=tags,lens='direct' if orientation=='upright' else lens,coreRef=f'{key}.core',resourceRef=f'{key}.resource',difficultyRef=f'{key}.difficulty',actionRef=f'{key}.action',questionRef=f'{key}.question',topicRefs={t:f'topic.{tags[0]}.{t}' for t in topics},roleRefs={r:f'role.{tags[0]}.{r}' for r in roles})
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
    rules.append(dict(id=id,kind='repetition',left=theme,right=theme,priority=40,relationRef=f'relation.{id}',actionRefs={t:f'action.repeat.{theme}.{t}' for t in topics},questionRefs={t:f'question.repeat.{theme}.{t}' for t in topics}))
for id,kind,left,right,priority,relation,action,question in rows('relations.tsv',8):
    strings[f'relation.{id}']=relation
    for i,t in enumerate(topics):
        strings[f'action.{id}.{t}']=scopes[i]+', '+action
        strings[f'question.{id}.{t}']=scopes[i]+', '+question[0].lower()+question[1:]
    rules.append(dict(id=id,kind=kind,left=left,right=right,priority=int(priority),relationRef=f'relation.{id}',actionRefs={t:f'action.{id}.{t}' for t in topics},questionRefs={t:f'question.{id}.{t}' for t in topics}))
flows={
'present':['To understand the present, start with the conditions rather than a prediction. {0}','The first perspective offers {0}.','The second asks you to examine {0}.','For a helpful direction: {0}','The cards do not establish a strong shared relationship under these rules. Use their sequence as a resource to notice, a difficulty to examine and a direction to consider; they need not tell one hidden story.'],
'crossroads':['This spread examines the basis of a choice; it does not choose an outcome for you. {0}','In weighing your values, consider {0}.','Among the less visible conditions, examine {0}.','Before deciding: {0}','No strong relationship is supported here. Keep the three checks distinct: what you value, what a choice may conceal and what needs checking before commitment.'],
'action':['For a next step, work at the scale of an experiment rather than a promised outcome. {0}','Your starting resource is {0}.','The difficulty to account for is {0}.','Keep the next move bounded: {0}','No strong shared relationship is supported. Begin with the available resource, allow for the difficulty and test a small action without treating the cards as a prediction.']}
for intent,parts in flows.items():
    for part,text in zip(['opening','first','second','third','fallback'],parts):strings[f'flow.{intent}.{part}']=text
assert len(meanings)==156
outputs={'semantics.1.json':dict(versions=versions,meanings=meanings,referenceIds=sorted(strings)), 'rules.1.json':dict(versions=versions,rules=rules),'reading.en.1.json':dict(schemaVersion=1,version='reading.en.1',locale='en',strings=strings)}
for name,data in outputs.items():
    text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    for path in [source/name,root/'apps/web/public/content/reading'/name]:
        if '--check' in sys.argv:assert path.read_text()==text, f'Stale generated pack: {path}'
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
print(f'{len(meanings)} meanings; {len(rules)} rules; {len(strings)} localized references')
