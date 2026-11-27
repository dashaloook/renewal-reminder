"""Main user flows in a real browser (demo account, nothing is sent anywhere).

Run:  pip install -r tests/e2e/requirements.txt && playwright install chromium
      python -m pytest tests/e2e -v
"""
import datetime as dt
import re

from playwright.sync_api import Page, expect


def iso(days):
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


def start_demo(page: Page, base_url):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    expect(page.get_by_role("heading", name="No more surprise charges.")).to_be_visible()
    page.get_by_role("button", name="Skip").click()
    expect(page).to_have_url(re.compile(r"#/dashboard$"))


def pick_date(page: Page, field_id, day_iso):
    page.locator(f"#{field_id}").click()
    cell = page.locator(f'[data-d="{day_iso}"]')
    for _ in range(14):  # the date may be in a later month
        if cell.count() and cell.first.is_visible():
            break
        page.get_by_role("button", name="Next month").click()
    cell.first.click()


def add_reminder(page: Page, name, amount="12.50", days=20, note=""):
    page.goto(page.url.split("#")[0] + "#/new")
    page.locator(".chip", has_text="Enter manually").click()
    page.locator("#f-name").fill(name)
    page.locator("#f-amount").fill(amount)
    pick_date(page, "f-date", iso(days))
    if note:
        page.locator("#f-note").fill(note)
    page.get_by_role("button", name="Save reminder").click()
    dialog = page.get_by_role("dialog", name=re.compile("Added"))
    expect(dialog).to_be_visible()
    return dialog


def row(page: Page, name):
    return page.locator(".rrow", has_text=name)


def find(page: Page, name):
    """Switch to the list view (the calendar shows one month) and search."""
    page.goto(page.url.split("#")[0] + "#/reminders")
    page.get_by_role("radio", name="List view").click()
    page.get_by_placeholder(re.compile("Search", re.I)).first.fill(name)
    return row(page, name)


def open_details(page: Page, name):
    find(page, name).first.click()
    drawer = page.get_by_role("dialog", name=name)
    expect(drawer).to_be_visible()
    return drawer


# ---------------------------------------------------------------- tests

def test_login_screen_offers_google_and_demo(page: Page, base_url, errors):
    page.goto(base_url + "/")
    expect(page.get_by_role("heading", name="Log in")).to_be_visible()
    expect(page.get_by_role("button", name="Continue with Google")).to_be_visible()
    expect(page.get_by_role("button", name="Try the demo without signing up")).to_be_visible()


def test_onboarding_adds_picked_services(page: Page, base_url, errors):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    expect(page.get_by_role("heading", name="No more surprise charges.")).to_be_visible()
    page.get_by_role("button", name="Let’s find yours").click()
    expect(page.get_by_role("heading", name="What do you pay for?")).to_be_visible()
    expect(page.get_by_role("button", name="Add 1 reminder")).to_be_visible()     # only the first service is preselected
    expect(page.locator(".onb3-svc.on")).to_have_count(1)
    expect(page.locator(".onb3-svc.on")).to_contain_text("Netflix")
    page.get_by_role("button", name=re.compile("^Telegram Premium")).click()  # add Telegram Premium
    page.get_by_role("radiogroup", name="Telegram Premium plan").get_by_role("radio", name=re.compile("Yearly")).click()
    page.get_by_role("button", name=re.compile("^Claude")).click()              # add Claude
    page.get_by_role("radiogroup", name="Claude plan").get_by_role("radio", name=re.compile("Max 5")).click()
    page.get_by_role("button", name="Add 3 reminders").click()
    expect(page.get_by_role("heading", name="You’re covered 🎉")).to_be_visible()
    for text in ("Netflix", "Telegram Premium", "Yearly", "Claude", "Max 5"):
        expect(page.locator(".onb3-sum")).to_contain_text(text)
    page.get_by_role("button", name="Go to my dashboard").click()
    expect(page).to_have_url(re.compile(r"#/dashboard$"))
    page.goto(base_url + "/#/reminders")
    expect(find(page, "Telegram Premium")).to_contain_text("$35.99")      # dollars by default
    expect(find(page, "Claude")).to_contain_text("$100.00")


def test_claude_is_listed_right_after_chatgpt(page: Page, base_url, errors):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    page.get_by_role("button", name="Let’s find yours").click()
    names = page.locator(".onb3-svc-head b").all_inner_texts()
    assert names.index("Claude") == names.index("ChatGPT") + 1, names


def test_add_reminder_shows_in_list_with_note(page: Page, base_url, errors):
    start_demo(page, base_url)
    dialog = add_reminder(page, "QA Streaming", note="Shared with Sam")
    expect(dialog).to_contain_text("QA Streaming")
    expect(dialog).to_contain_text("Shared with Sam")
    dialog.get_by_role("button", name="Go to my list").click()
    expect(row(page, "QA Streaming")).to_be_visible()
    expect(row(page, "QA Streaming")).to_contain_text("Shared with Sam")


def test_form_explains_missing_fields(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    page.locator("#f-amount").fill("abc")
    page.get_by_role("button", name="Save reminder").click()
    expect(page.get_by_text(re.compile("Add a name so you know what this is"))).to_be_visible()
    expect(page.get_by_text(re.compile("Add the next charge or expiry date"))).to_be_visible()
    expect(page.get_by_text("Use numbers only, like 9.99.").first).to_be_visible()
    expect(page).to_have_url(re.compile(r"#/new$"))  # nothing saved


def test_keep_it_then_undo(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Keep").get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Keep")
    drawer.get_by_role("button", name="Keep it").click()
    expect(page.get_by_role("button", name="Undo")).to_be_visible()
    page.get_by_role("button", name="Undo").click()
    drawer = page.get_by_role("dialog", name="QA Keep")  # undo reopens the details it came from
    expect(drawer).to_be_visible()
    expect(drawer.get_by_role("button", name="Keep it")).to_be_visible()


def test_decide_later_moves_to_unfinished(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Later", days=25).get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Later")
    drawer.get_by_role("button", name="Decide later").click()
    later = page.get_by_role("dialog", name="Decide later")
    later.locator('[role="radiogroup"] .chip').first.click()
    later.get_by_role("button", name="Save and remind me").click()
    expect(later).to_be_hidden()
    expect(find(page, "QA Later")).to_contain_text(re.compile("Postponed|Unfinished|Decide", re.I))
    page.get_by_placeholder(re.compile("Search", re.I)).first.fill("")
    page.locator(".badge-btn").first.click()  # "N need a decision" opens the Unfinished tab
    expect(page.locator(".rrow", has_text="QA Later")).to_be_visible()


def test_edit_reminder(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Edit").get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Edit")
    drawer.get_by_role("button", name="Edit").click()
    expect(page.get_by_role("heading", name="Edit QA Edit")).to_be_visible()
    page.locator("#f-name").fill("QA Edited")
    page.get_by_role("button", name="Save changes").click()
    expect(find(page, "QA Edited")).to_have_count(1)
    expect(find(page, "QA Edit")).to_have_count(1)  # only the renamed one; the old name is gone


def test_delete_asks_first_and_can_be_undone(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Delete").get_by_role("button", name="Go to my list").click()
    drawer = open_details(page, "QA Delete")
    drawer.get_by_role("button", name="Delete").click()
    confirm = page.get_by_role("alertdialog")
    expect(confirm).to_contain_text("Delete the QA Delete reminder?")
    confirm.get_by_role("button", name="Delete reminder").click()
    expect(row(page, "QA Delete")).to_have_count(0)
    page.get_by_role("button", name="Undo").click()
    expect(page.get_by_role("dialog", name="QA Delete")).to_be_visible()  # restored, details reopened
    page.get_by_role("button", name="Close details").click()
    expect(find(page, "QA Delete")).to_have_count(1)


def test_reminders_survive_reload(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Reload").get_by_role("button", name="Go to my list").click()
    page.reload()
    expect(find(page, "QA Reload")).to_be_visible()


def test_search_finds_reminder(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Search Unique").get_by_role("button", name="Go to my list").click()
    expect(find(page, "QA Search Unique")).to_be_visible()
    expect(page.locator(".rrow")).to_have_count(1)


def test_phone_width_has_no_sideways_scroll(page: Page, base_url, errors):
    page.set_viewport_size({"width": 375, "height": 812})
    start_demo(page, base_url)

    def check(where):
        page.wait_for_timeout(300)
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 0, f"{where} scrolls sideways by {overflow}px at 375px wide"

    for route in ("dashboard", "reminders", "new"):
        page.goto(base_url + "/#/" + route)
        expect(page.locator(".skel, [aria-busy=true]")).to_have_count(0)
        check("#" + route)
    page.goto(base_url + "/#/reminders")
    page.get_by_role("radio", name="List view").click()
    check("list view")
    search = page.locator("#ls").bounding_box()
    assert search["height"] < 60, "search box should not stretch into a tall empty block"


def test_phone_profile_opens_as_bottom_sheet(page: Page, base_url, errors):
    page.set_viewport_size({"width": 390, "height": 844})
    start_demo(page, base_url)
    page.get_by_role("button", name="Profile").click()
    sheet = page.get_by_role("dialog", name="Alex Koval")
    expect(sheet).to_be_visible()
    expect(sheet.get_by_role("button", name="Log out")).to_be_visible()
    page.wait_for_timeout(400)  # slide-up animation
    box = sheet.bounding_box()
    assert abs(box["y"] + box["height"] - 844) <= 1, "sheet should sit on the bottom edge"
    sheet.get_by_role("button", name="Cancel").click()
    expect(sheet).to_be_hidden()


def test_note_warns_when_pasted_text_lost_its_letters(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    page.locator("#f-note").fill("Обов'язково перевірити ціну")
    expect(page.get_by_text(re.compile("came through as"))).to_have_count(0)
    page.locator("#f-note").fill("???'?????? ????????")
    expect(page.get_by_text(re.compile("came through as"))).to_be_visible()


def test_next_years_dates_show_the_year(page: Page, base_url, errors):
    start_demo(page, base_url)
    days = (dt.date(dt.date.today().year + 1, 1, 15) - dt.date.today()).days  # mid-January next year
    add_reminder(page, "QA Next Year", days=days).get_by_role("button", name="Go to my list").click()
    expect(open_details(page, "QA Next Year")).to_contain_text(f"15 January {dt.date.today().year + 1}")


def test_note_grows_and_clear_button_empties_it(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    note = page.locator("#f-note")
    expect(page.get_by_role("button", name="Clear note")).to_have_count(0)
    empty_h = note.bounding_box()["height"]
    note.fill("Довга нотатка, яка займає кілька рядків. " * 12)
    assert note.bounding_box()["height"] > empty_h * 2, "note should grow with its text"
    assert note.evaluate("e => e.scrollHeight - e.clientHeight") <= 0, "no scrolling inside the note"
    page.get_by_role("button", name="Clear note").click()
    expect(note).to_have_value("")
    expect(note).to_be_focused()


def test_phone_sheet_log_out_works(page: Page, base_url, errors):
    page.set_viewport_size({"width": 390, "height": 844})
    start_demo(page, base_url)
    page.get_by_role("button", name="Profile").click()
    page.get_by_role("dialog", name="Alex Koval").get_by_role("button", name="Log out").click()
    expect(page.get_by_role("heading", name="Log in")).to_be_visible()


def test_phone_form_has_fixed_save_bar_and_no_tab_bar(page: Page, base_url, errors):
    page.set_viewport_size({"width": 390, "height": 844})
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    expect(page.locator(".bottom-bar")).to_be_hidden()
    bar = page.locator(".form-bar")
    expect(bar).to_be_visible()
    page.locator("#f-name").fill("QA Bar")
    pick_date(page, "f-date", iso(20))
    expect(bar).to_contain_text("We’ll remind you on")
    bar.get_by_role("button", name="Save reminder").click()
    expect(page.get_by_role("dialog", name=re.compile("Added"))).to_be_visible()


def test_statistics_hide_categories_without_costs(page: Page, base_url, errors):
    start_demo(page, base_url)
    card = page.locator(".card", has=page.get_by_role("heading", name="Spend by category"))
    expect(card).not_to_contain_text("No cost")


def test_onboarding_back_takes_back_added_reminders(page: Page, base_url, errors):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    page.get_by_role("button", name="Let’s find yours").click()
    page.get_by_role("button", name=re.compile("^Claude")).click()
    page.get_by_role("button", name="Add 2 reminders").click()
    expect(page.get_by_role("heading", name="You’re covered 🎉")).to_be_visible()
    page.get_by_role("button", name="Back").click()                      # back to step 2, Claude removed again
    expect(page.get_by_role("heading", name="What do you pay for?")).to_be_visible()
    page.get_by_role("button", name=re.compile("^Claude")).click()       # unselect Claude
    page.get_by_role("button", name="Add 1 reminder").click()
    page.get_by_role("button", name="Back").click()
    page.get_by_role("button", name="Back").click()                      # back to step 1
    expect(page.get_by_role("heading", name="No more surprise charges.")).to_be_visible()
    page.get_by_role("button", name="Let’s find yours").click()
    page.get_by_role("button", name="Add 1 reminder").click()
    page.get_by_role("button", name="Go to my dashboard").click()
    page.goto(base_url + "/#/reminders")
    expect(find(page, "Claude")).to_have_count(0)


def test_famous_services_show_their_logo(page: Page, base_url, errors):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    page.get_by_role("button", name="Let’s find yours").click()
    logos = page.locator(".onb3-svc .brand-logo img")
    expect(logos).to_have_count(13)                                  # all but the Ukrainian TV services
    page.wait_for_function("[...document.querySelectorAll('.brand-logo img')].every(i => i.complete && i.naturalWidth > 0)")
    expect(page.locator(".onb3-svc", has_text="Megogo").locator(".topic-logo svg")).to_have_count(1)  # no free logo: TV icon
    expect(page.locator(".onb3-svc", has_text="Disney+")).to_have_count(0)   # not available in Ukraine
    start_demo(page, base_url)
    page.goto(base_url + "/#/reminders")
    page.get_by_role("radio", name="List view").click()
    expect(page.locator(".rrow", has_text="Netflix").locator(".brand-logo img")).to_have_attribute("src", "logos/netflix.svg")
    expect(page.locator(".rrow", has_text="Gym membership").locator(".topic-logo svg")).to_have_count(1)  # dumbbell icon


def test_mac_paste_with_question_marks_uses_formatted_copy(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    value = page.evaluate("""() => { const el = document.getElementById('f-note'); el.focus(); const dt = new DataTransfer();
        dt.setData('text/plain', '?? Rive ???????? Realm: ?????????');
        dt.setData('text/html', '<meta charset="utf-8"><p>Rive запускає Realm: платформу з іграми</p>');
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return el.value; }""")
    assert value == "Rive запускає Realm: платформу з іграми", value
    expect(page.get_by_text(re.compile("came through as"))).to_have_count(0)


def test_phone_date_picker_stays_inside_its_card(page: Page, base_url, errors):
    page.set_viewport_size({"width": 375, "height": 812})
    start_demo(page, base_url)
    page.goto(base_url + "/#/new")
    page.locator(".chip", has_text="Enter manually").click()
    page.locator("#f-date").click()
    box = page.evaluate("""() => { const a = document.querySelector('.dp').getBoundingClientRect(), h = document.getElementById('f-date').closest('.card').getBoundingClientRect();
        return { inside: a.left >= h.left - 0.5 && a.right <= h.right + 0.5, w: a.width, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }""")
    assert box["inside"] and box["w"] <= 296 and box["sideways"] <= 0, box


def test_delete_confirmation_has_centred_icon_and_title(page: Page, base_url, errors):
    start_demo(page, base_url)
    add_reminder(page, "QA Confirm").get_by_role("button", name="Go to my list").click()
    open_details(page, "QA Confirm").get_by_role("button", name="Delete").click()
    confirm = page.get_by_role("alertdialog")
    expect(confirm.locator(".logo")).to_be_visible()
    expect(confirm.get_by_role("heading")).to_have_css("text-align", "center")


def test_dashboard_charts_open_the_calendar(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.locator(".cb-row", has_text="Insurance").click()
    expect(page.locator('[aria-label="Category"] .chip[aria-pressed=true]')).to_contain_text("Insurance")
    expect(page.locator(".cal-name")).not_to_contain_text("Nothing due")          # opens on its next payment
    page.goto(base_url + "/#/dashboard")
    month = page.locator(".mb-col").nth(3)
    long_name = month.get_attribute("aria-label").split(":")[0]                    # e.g. "February 2027"
    month.click()
    expect(page.locator("#cal-h")).to_have_text(long_name)
    assert page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 0


def test_search_suggests_your_reminders_and_shows_results(page: Page, base_url, errors):
    start_demo(page, base_url)
    page.goto(base_url + "/#/reminders")
    page.locator("#ls").click()
    page.locator("#ls").fill("Net")
    sug = page.get_by_role("listbox", name="Suggestions")
    expect(sug.locator(".option").first).to_contain_text("Netflix")             # best match first
    expect(page.locator(".cal")).to_have_count(0)                               # results page instead of the calendar
    expect(page.locator(".search-head")).to_contain_text("results for “Net”")
    sug.locator(".option").first.click()
    expect(page.get_by_role("dialog", name="Netflix")).to_be_visible()
    page.get_by_role("button", name="Close details").click()
    expect(page.get_by_role("listbox", name="Suggestions")).to_have_count(0)
    page.locator("#ls").fill("Megogo")
    expect(page.get_by_role("listbox", name="Suggestions")).to_contain_text("Add Megogo")
    page.locator(".card.empty").get_by_role("button", name="Clear search").click()
    expect(page.locator(".cal")).to_have_count(1)                               # calendar is back


def test_currency_defaults_to_dollars_and_can_switch(page: Page, base_url, errors):
    page.goto(base_url + "/")
    page.get_by_role("button", name="Try the demo without signing up").click()
    page.get_by_role("button", name="Let’s find yours").click()
    cur = page.get_by_role("radiogroup", name="Currency")
    expect(cur.get_by_role("radio", name="US dollar")).to_have_attribute("aria-checked", "true")
    cur.get_by_role("radio", name="Hryvnia").click()
    expect(cur.get_by_role("radio", name="Hryvnia")).to_have_attribute("aria-checked", "true")
    page.get_by_role("button", name="Add 1 reminder").click()
    page.get_by_role("button", name="Go to my dashboard").click()
    page.goto(base_url + "/#/reminders")
    expect(find(page, "Netflix").first).to_contain_text("₴")
    page.goto(base_url + "/#/new")
    expect(page.locator("label", has_text="UAH")).to_have_count(1)    # amount field shows the currency
