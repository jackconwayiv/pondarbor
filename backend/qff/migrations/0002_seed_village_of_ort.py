from django.db import migrations


def seed_world(apps, schema_editor):
    Area = apps.get_model("qff", "Area")
    Room = apps.get_model("qff", "Room")
    AreaCell = apps.get_model("qff", "AreaCell")
    RoomExit = apps.get_model("qff", "RoomExit")
    CharacterClass = apps.get_model("qff", "CharacterClass")

    CharacterClass.objects.get_or_create(
        slug="nurse",
        defaults={"name": "Nurse", "sort_order": 0},
    )
    CharacterClass.objects.get_or_create(
        slug="gym_rat",
        defaults={"name": "Gym Rat", "sort_order": 1},
    )

    area, _ = Area.objects.get_or_create(
        slug="village-of-ort",
        defaults={
            "name": "Village of Ort",
            "description": "A small settlement in the realm.",
            "grid_width": 3,
            "grid_height": 3,
        },
    )

    def mk_room(name, desc, search=""):
        r, _ = Room.objects.get_or_create(
            area=area,
            name=name,
            defaults={"description": desc, "search_text": search, "slug": ""},
        )
        if r.description != desc:
            r.description = desc
            r.search_text = search
            r.save()
        return r

    # Grid: x 0..2 left-right, y 0..2 north-south (y=0 is north row)
    rooms = {}
    rooms["mayor"] = mk_room(
        "Mayor's House",
        "Though not wealthy, the mayor has the most impressive home in the village. "
        "If you consider four standing walls and a drooping thatched roof impressive.",
    )
    rooms["well"] = mk_room(
        "Village Well",
        "In the village green, a ramshackle pile of stones does its best impression of a well. "
        "A frayed string suspends a wooden pail above a pool of muddy water some feet below.",
        search="You notice a faded coin glinting in the mud — too deep to reach.",
    )
    rooms["nw"] = mk_room(
        "Northwest Hovel",
        "A crooked hut that barely qualifies as shelter. Nobody answers a knock.",
    )
    rooms["ne"] = mk_room(
        "Northeast Yard",
        "Weeds and a rusted gate. The path continues elsewhere.",
    )
    rooms["w"] = mk_room(
        "West Lane",
        "Muddy ruts suggest carts sometimes pass through.",
    )
    rooms["e"] = mk_room(
        "East Lane",
        "The smell of woodsmoke drifts from the village center.",
    )
    rooms["sw"] = mk_room(
        "Southwest Shed",
        "Empty except for spiders and old straw.",
    )
    rooms["s"] = mk_room(
        "South Path",
        "The trail south is barely more than trampled grass.",
    )
    rooms["se"] = mk_room(
        "Southeast Brambles",
        "Thorns catch at your sleeves. There might be a way through — or not.",
    )

    placements = {
        (0, 0): "nw",
        (1, 0): "mayor",
        (2, 0): "ne",
        (0, 1): "w",
        (1, 1): "well",
        (2, 1): "e",
        (0, 2): "sw",
        (1, 2): "s",
        (2, 2): "se",
    }

    for (x, y), key in placements.items():
        room = rooms[key]
        AreaCell.objects.update_or_create(
            area=area,
            x=x,
            y=y,
            defaults={"room": room},
        )

    def two_way(a_key, b_key, dir_ab, dir_ba):
        ra = rooms[a_key]
        rb = rooms[b_key]
        RoomExit.objects.update_or_create(
            from_room=ra,
            direction=dir_ab,
            defaults={"to_room": rb, "is_hidden": False, "lock_kind": "none"},
        )
        RoomExit.objects.update_or_create(
            from_room=rb,
            direction=dir_ba,
            defaults={"to_room": ra, "is_hidden": False, "lock_kind": "none"},
        )

    # Orthogonal grid links
    two_way("nw", "mayor", "e", "w")
    two_way("mayor", "ne", "e", "w")
    two_way("nw", "w", "s", "n")
    two_way("mayor", "well", "s", "n")
    two_way("ne", "e", "s", "n")
    two_way("w", "well", "e", "w")
    two_way("well", "e", "e", "w")
    two_way("w", "sw", "s", "n")
    two_way("well", "s", "s", "n")
    two_way("e", "se", "s", "n")
    two_way("sw", "s", "e", "w")
    two_way("s", "se", "e", "w")

    # Mayor's House: per spec, exits south, east, west only (no north) — already satisfied by grid


def unseed_world(apps, schema_editor):
    Area = apps.get_model("qff", "Area")
    Area.objects.filter(slug="village-of-ort").delete()
    CharacterClass = apps.get_model("qff", "CharacterClass")
    CharacterClass.objects.filter(slug__in=["nurse", "gym_rat"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_world, unseed_world),
    ]
